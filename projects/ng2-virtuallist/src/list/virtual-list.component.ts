import { ListComponent, IItemRendererContext } from '../list/list.component';
import {
    Component,
    ViewEncapsulation,
    ChangeDetectionStrategy,
    ViewChild,
    ViewContainerRef,
    Input,
    ElementRef,
    Renderer2,
    SimpleChanges,
    EmbeddedViewRef,
    ChangeDetectorRef,
    NgZone,
    ViewRef,
    TemplateRef
} from '@angular/core';
import { OutletComponent } from '../core/outlet';
import { fromEvent, merge, Subject } from 'rxjs';
import { bufferTime, debounceTime, filter } from 'rxjs/operators';

export interface IVirtualLayoutInfo {
    type: 'vertical';
    startIndex: number;
    endIndex: number;
    virtualTop: number;
    virtualHeight: number;
    height: number;
}

// export interface IVirtualIndex {
//     startIndex: number;
//     endIndex: number;
// }

@Component({
    selector: 'ne-list',
    templateUrl: './virtual-list.component.html',
    styleUrls: ['./virtual-list.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualListComponent<T> extends ListComponent<T> {
    constructor(
        elementRef: ElementRef,
        renderer: Renderer2,
        cdr: ChangeDetectorRef,
        private ngZone: NgZone) {
        super(elementRef, renderer, cdr);
    }
    private virtualLayoutStrategy: 'none' | 'viewportOnly' | 'progressive' = 'viewportOnly';
    private recycleRendererStrategy: 'none' | 'trackByRenderer' | 'trackByItem' = 'trackByRenderer';
    @Input() scrollContainer: HTMLElement;
    @Input() bufferAmount = 0;
    @ViewChild('contentShimRef', { read: ElementRef }) private _contentShimRef: ElementRef;
    @ViewChild('contentElementRef', { read: ElementRef }) private _contentElementRef: ElementRef;
    private _getScrollContainer(): HTMLElement {
        if (this.scrollContainer) {
            return this.scrollContainer;
        } else {
            return this.elementRef.nativeElement;
        }
    }
    private _isPresetedContainerDim: boolean;
    protected _isPresetedContainerDimensions(): boolean {
        if (this._isPresetedContainerDim === undefined) {
            // 计算是否预设了宽高
            const rect = this._getScrollContainer().getBoundingClientRect();
            this._isPresetedContainerDim = !!(rect && rect.width && rect.height);
        }
        return this._isPresetedContainerDim === true;
    }
    private _isTypicalItem(item: T): boolean {
        return true;
    }
    private _findTypicalItem(): T {
        if (this.dataProvider) {
            return this.dataProvider.find(item => this._isTypicalItem(item));
        }
        return null;
    }
    private _findTypicalElement(): HTMLElement {
        const length = this._itemRendererOutlet.length;
        let viewRef: EmbeddedViewRef<IItemRendererContext<T>>;
        let element: HTMLElement = this._itemRendererOutlet.element.nativeElement as HTMLElement;
        for (let i = 0; i < this._itemRendererOutlet.length; i++) {
            viewRef = this._itemRendererOutlet.get(i) as EmbeddedViewRef<IItemRendererContext<T>>;
            element = element.nextElementSibling as HTMLElement;
            if (viewRef && viewRef.context && this._isTypicalItem(viewRef.context.item)) {
                return element;
            }
        }
        return null;
    }
    private _calcVirtualLayou(typicalElement: HTMLElement): IVirtualLayoutInfo {
        const scrollEl = this._getScrollContainer();
        const shimEl = this._contentShimRef.nativeElement;
        const scrollRect = scrollEl.getBoundingClientRect();
        const shimRect = shimEl.getBoundingClientRect();
        const itemRect: ClientRect = typicalElement.getBoundingClientRect();
        const itemWidth = itemRect.width;
        const itemHeight = itemRect.height;
        const width = shimRect.width;
        const virtualWidth = width;
        const virtualColumnCount = itemWidth ? Math.floor(virtualWidth / itemWidth) : 1;
        const height = Math.ceil(this.dataProvider.length / virtualColumnCount) * itemHeight;
        const virtualHeight = Math.max(0, Math.min(shimRect.top + height, scrollRect.bottom) - Math.max(shimRect.top, scrollRect.top));
        const virtualRowCount = itemHeight ? Math.ceil(virtualHeight / itemHeight) : 0;
        // 计算shim容器相对于List组件的顶部偏移
        const offsetTop = scrollRect.top - shimRect.top;
        // 计算起止索引
        const startIndex = Math.max(0, virtualColumnCount * Math.floor(offsetTop / itemHeight) - this.bufferAmount);
        const endIndex = Math.min(this.dataProvider.length, this.bufferAmount * 2 + startIndex + virtualColumnCount * virtualRowCount);
        // 计算虚拟容器偏移virtualEndIndex
        const virtualTop = itemHeight * startIndex;
        return {
            type: 'vertical',
            startIndex: startIndex,
            endIndex: endIndex,
            virtualTop: virtualTop,
            virtualHeight: virtualHeight,
            height: height
        };
    }
    private _measureVirtualDisplay$: Subject<IVirtualLayoutInfo> = new Subject();
    private _measureVirtualDisplay(): void {
        const typicalElement = this._findTypicalElement();
        if (!typicalElement) {
            const typicalItem = this._findTypicalItem();
            if (!typicalItem) { return null; }
            const index = this._itemRendererOutlet.length;
            this._createItemRenderer(this._getItemRendererContext(typicalItem, this.dataProvider.indexOf(typicalItem)), index);
            this._callLater(() => {
                this._measureVirtualDisplay$.next(this._calcVirtualLayou(this._findTypicalElement()));
            });
        } else {
            this._measureVirtualDisplay$.next(this._calcVirtualLayou(typicalElement));
        }
    }
    protected _updateVirtualDisplay(layoutInfo: IVirtualLayoutInfo) {
        // 设置偏移及shim的实际高度
        this.renderer.setStyle(this._contentElementRef.nativeElement, 'top', `${layoutInfo.virtualTop}px`);
        this.renderer.setStyle(this._contentShimRef.nativeElement, 'height', `${layoutInfo.height}px`);

        this._itemRendererOutlet.clear();
        let context;
        const viewportItems = this.dataProvider.slice(layoutInfo.startIndex, layoutInfo.endIndex);
        viewportItems.forEach((item, index) => {
            context = this._getItemRendererContext(item, index + layoutInfo.startIndex);
            if (!this._recycleItemRenderer(context, index)) {
                this._createItemRenderer(context, index);
            }
        });
        // 清理超出数据集合的Renderer实例
        for (let i: number = viewportItems.length; i < this._itemRendererOutlet.length; i++) {
            this._dropItemRenderer(i);
        }
        this.cdr.detectChanges();
    }
    protected _updateDisplay() {
        if (this._itemRendererOutlet) {
            if (!this._isPresetedContainerDimensions()) {
                super._updateDisplay();
            } else {
                this._measureVirtualDisplay();
            }
        }
    }
    protected _recycleItemRenderer(context: IItemRendererContext<T>, viewIndex: number) {
        return super._recycleItemRenderer(context, viewIndex);
    }
    neOnInit() {
        super.neOnInit();
        this._pipeUntilDestroy(
            this._measureVirtualDisplay$
        ).subscribe(this._updateVirtualDisplay.bind(this));
        this._pipeUntilDestroy(merge(
            fromEvent(window, 'resize'),
            fromEvent(this._getScrollContainer(), 'scroll')
        )).subscribe(this._updateDisplay.bind(this));
    }
    neOnChanges(changes: SimpleChanges) {
        super.neOnChanges(changes);
        this._updateClass({
            'ne-list': true,
            'ne-multi-selection': this.multiSelectionEnabled,
            'ne-scroll-container': !this.scrollContainer
        });
    }
}
