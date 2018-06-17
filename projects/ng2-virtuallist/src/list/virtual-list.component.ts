import { ListComponent } from '../list/list.component';
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
    TemplateRef,
    ComponentFactoryResolver,
    HostBinding,
    ComponentRef
} from '@angular/core';
import { OutletComponent } from '../core/outlet';
import { fromEvent, merge, Subject } from 'rxjs';
import { debounceTime, bufferTime, take, map, tap } from 'rxjs/operators';
import { IItemRendererContext, IItemRendererStatic, ListItemWrapperComponent } from './list-item-wrapper.component';

export interface ITypicalItemInfo {
    itemWidth: number;
    itemHeight: number;
}

export interface IVirtualLayoutInfo {
    type: 'vertical';
    startIndex: number;
    endIndex: number;
    virtualTop: number;
    virtualHeight: number;
    height: number;
}

@Component({
    selector: 'ne-list',
    templateUrl: './virtual-list.component.html',
    styleUrls: ['./virtual-list.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualListComponent<T> extends ListComponent<T> {
    constructor(
        element: ElementRef,
        renderer: Renderer2,
        cdr: ChangeDetectorRef,
        componentFactoryResolver: ComponentFactoryResolver,
        private ngZone: NgZone
    ) {
        super(element, renderer, cdr, componentFactoryResolver);
    }
    @Input() virtualLayoutStrategy: 'none' | 'viewportOnly' | 'progressive' = 'viewportOnly';
    @Input() recycleRendererStrategy: 'none' | 'trackByRenderer' | 'trackByItem' = 'trackByRenderer';
    @Input() scrollContainer: HTMLElement;
    @Input() bufferAmount = 0;
    @Input() tileLayout = false;
    @ViewChild('contentShimRef', { read: ElementRef }) private _contentShimRef: ElementRef;
    @ViewChild('contentElementRef', { read: ElementRef }) private _contentElementRef: ElementRef;
    viewportItems: T[] = [];

    private _previousLayoutInfo: IVirtualLayoutInfo = <any>{};

    private _getScrollContainer(): HTMLElement {
        if (this.scrollContainer) {
            return this.scrollContainer;
        } else {
            return this.element.nativeElement;
        }
    }
    private _isTypicalItem(item: T): boolean {
        return true;
    }
    private _calcVirtualLayout(typicalItemInfo: ITypicalItemInfo): IVirtualLayoutInfo {
        const scrollEl = this._getScrollContainer();
        const shimEl = this._contentShimRef.nativeElement;
        const scrollRect = scrollEl.getBoundingClientRect();
        const shimRect = shimEl.getBoundingClientRect();
        // const itemRect: ClientRect = typicalElement.getBoundingClientRect();
        const itemWidth = typicalItemInfo.itemWidth;
        const itemHeight = typicalItemInfo.itemHeight;
        const width = shimRect.width;
        const virtualWidth = width;
        let virtualColumnCount = itemWidth ? Math.floor(virtualWidth / itemWidth) : 0;
        virtualColumnCount = virtualColumnCount || 1;
        const height = Math.ceil(this.dataProvider.length / virtualColumnCount) * itemHeight;
        const virtualHeight = Math.max(0, Math.min(shimRect.top + height, scrollRect.bottom) - Math.max(shimRect.top, scrollRect.top));
        const virtualRowCount = itemHeight ? Math.ceil(virtualHeight / itemHeight) : 0;
        // 计算shim容器相对于List组件的顶部偏移
        const offsetTop = scrollRect.top - shimRect.top;
        // 计算起止索引
        const startIndex = Math.max(0, virtualColumnCount * Math.floor(offsetTop / itemHeight) - this.bufferAmount);
        const endIndex = Math.min(this.dataProvider.length, this.bufferAmount * 2 + startIndex + virtualColumnCount * virtualRowCount);
        // 计算虚拟容器偏移virtualEndIndex
        const virtualTop = itemHeight * Math.floor(startIndex / virtualColumnCount);
        return {
            type: 'vertical',
            startIndex: startIndex,
            endIndex: endIndex,
            virtualTop: virtualTop,
            virtualHeight: virtualHeight,
            height: height
        };
    }
    private _typicalItemInfo: ITypicalItemInfo;
    private _measureTypicalItemInfo$: Subject<ITypicalItemInfo> = new Subject();
    private _measureTypicalItemInfo(): void {
        if (this._typicalItemInfo) {
            this._measureTypicalItemInfo$.next(this._typicalItemInfo);
        } else {
            let typicalItem, item, wrapper: ComponentRef<ListItemWrapperComponent<T>>;
            wrapper = this._getRendererAt(0);
            if (wrapper) {
                const rect = wrapper.instance.element.nativeElement.getBoundingClientRect();
                this._typicalItemInfo = {
                    itemWidth: rect.width,
                    itemHeight: rect.height
                };
                this._measureTypicalItemInfo$.next(this._typicalItemInfo);
            } else {
                if (this.dataProvider) {
                    for (let i = 0; i < this.dataProvider.length; i++) {
                        item = this.dataProvider[i];
                        wrapper = this._createItemRenderer(item, i);
                        if (this._isTypicalItem(item)) {
                            typicalItem = item;
                            break;
                        }
                    }
                }
                if (typicalItem) {
                    const instance = wrapper.instance;
                    instance.onCreatetionCompleted.subscribe(() => {
                        const rect = instance.element.nativeElement.getBoundingClientRect();
                        this._typicalItemInfo = {
                            itemWidth: rect.width,
                            itemHeight: rect.height
                        };
                        this._measureTypicalItemInfo$.next(this._typicalItemInfo);
                    });
                } else {
                    this._measureTypicalItemInfo$.next({ itemWidth: 0, itemHeight: 0 });
                }
            }
        }
    }
    private _measureVirtualDisplay$: Subject<IVirtualLayoutInfo> = new Subject();
    private _measureVirtualDisplay(): void {
        if (this._typicalItemInfo) {
            this._measureVirtualDisplay$.next(this._calcVirtualLayout(this._typicalItemInfo));
        } else {
            this._measureTypicalItemInfo();
        }
    }
    protected _updateVirtualDisplay(layoutInfo: IVirtualLayoutInfo) {
        // 设置偏移及shim的实际高度
        if (this._previousLayoutInfo.virtualTop !== layoutInfo.virtualTop) {
            this.renderer.setStyle(this._contentElementRef.nativeElement, 'top', `${layoutInfo.virtualTop}px`);
        }
        if (this._previousLayoutInfo.height !== layoutInfo.height) {
            this.renderer.setStyle(this._contentShimRef.nativeElement, 'height', `${layoutInfo.height}px`);
        }
        // if (this._previousLayoutInfo.type === layoutInfo.type
        //     && (this._previousLayoutInfo.startIndex !== layoutInfo.startIndex
        //     || this._previousLayoutInfo.endIndex !== layoutInfo.endIndex)
        // ) {
        //     // 如果布局类型发生变化，则跳过索引调整
        //     // 如果可见索引范围发生了变化, 则将起始索引上方的渲染器移动到下方
        //     this.viewportItems = this.dataProvider.slice(layoutInfo.startIndex, layoutInfo.endIndex);
        //     this.viewportItems.forEach((item, index) => {
        //         if (!this._recycleItemRenderer(item, index)) {
        //             this._createItemRenderer(item, index);
        //         }
        //     });
        // }
        this.viewportItems = this.dataProvider.slice(layoutInfo.startIndex, layoutInfo.endIndex);
        this.viewportItems.forEach((item, index) => {
            if (!this._recycleItemRenderer(item, index)) {
                this._createItemRenderer(item, index);
            }
        });
        // 清理超出数据集合的Renderer实例
        for (let i: number = this._itemRendererOutlet.length - 1; i >= this.viewportItems.length ; i--) {
            this._dropItemRenderer(i);
        }
        this._previousLayoutInfo = layoutInfo;
        this.cdr.detectChanges();
    }
    protected _updateDisplay() {
        if (this._itemRendererOutlet) {
            if (this.virtualLayoutStrategy === 'none') {
                super._updateDisplay();
            } else {
                this._measureVirtualDisplay();
            }
        }
    }
    protected _recycleItemRenderer(item: T, viewIndex: number) {
        if (this.recycleRendererStrategy === 'trackByRenderer') {
            return super._recycleItemRenderer(item, viewIndex);
        } else if (this.recycleRendererStrategy === 'trackByItem') {
            return null;
        } else {
            return null;
        }
    }
    protected _updateRendererSelected(item, viewIndex, selected) {
        if (this.virtualLayoutStrategy === 'none') {
            super._updateRendererSelected(item, viewIndex, selected);
        } else {
            super._updateRendererSelected(item, this.viewportItems.indexOf(item), selected);
        }
    }
    neOnDestroy() {
        super.neOnDestroy();
        this._measureTypicalItemInfo$.complete();
        this._measureVirtualDisplay$.complete();
    }
    neOnInit() {
        super.neOnInit();
        merge(
            this._measureTypicalItemInfo$.pipe(
                map(this._calcVirtualLayout.bind(this)),
                tap(this._measureVirtualDisplay$)
            ),
            this._measureVirtualDisplay$
        ).subscribe(this._updateVirtualDisplay.bind(this));

        this._pipeUntilDestroy(
            fromEvent(window, 'resize')
        ).subscribe(() => {
            if (this._itemRendererOutlet && this.virtualLayoutStrategy !== 'none') {
                // 清除布局信息缓存
                this._typicalItemInfo = null;
                this._measureVirtualDisplay();
            }
        });
        this._pipeUntilDestroy(
            fromEvent(this._getScrollContainer(), 'scroll')
        ).subscribe(() => {
            if (this._itemRendererOutlet && this.virtualLayoutStrategy !== 'none') {
                this._measureVirtualDisplay();
            }
        });
    }
    protected _shouldClearLayout(changes: SimpleChanges) {
        return changes
            && this._itemRendererOutlet
            && (
                'dataProvider' in changes
                || 'itemRenderer' in changes
                || 'itemRendererFactory' in changes
            );
    }
    protected _shouldClearTypicalInfo(changes: SimpleChanges) {
        return changes
            && (
                'itemRenderer' in changes
                || 'itemRendererFactory' in changes
            );
    }
    neOnChanges(changes: SimpleChanges) {
        if (this._shouldClearLayout(changes)) {
            this._previousLayoutInfo = <any>{};
        }
        if (this._shouldClearTypicalInfo(changes)) {
            this._typicalItemInfo = null;
        }
        super.neOnChanges(changes);
        this._updateClass({
            'ne-list': true,
            'ne-multi-selection': this.multiSelectionEnabled,
            'ne-scroll-container': !this.scrollContainer,
            'ne-virtual-layout': this.virtualLayoutStrategy !== 'none',
            'ne-tile-layout': !!this.tileLayout,
        });
    }
}
