import {
    Component,
    Input,
    TemplateRef,
    EventEmitter,
    Output,
    SimpleChanges,
    Renderer2,
    ViewContainerRef,
    ContentChild,
    ViewEncapsulation,
    ViewChild,
    ElementRef,
    isDevMode,
    ChangeDetectionStrategy,
    ComponentFactoryResolver,
    ComponentFactory,
    EmbeddedViewRef,
    ChangeDetectorRef
} from '@angular/core';
import { UIComponent, IUIEvent } from '../core/ui';
import { NgTemplateOutlet } from '@angular/common';
import { OutletComponent } from '../core/outlet';
import { isDefined } from '../core/utils';

export type TrackByFunction<T> = (item: T) => any;
export type TrackByField = string;
export type ItemLabelFunction<T> = (item: T) => string;
export type ItemLabelField = string;
export type ItemRendererFactoryFunction<T> = (item: T) => TemplateRef<IItemRendererContext<T>>;
export interface IItemRendererContext<T> {
    $implicit: T;
    item: T;
    index: number;
    label: string;
    selected: boolean;
    templateRef: TemplateRef<IItemRendererContext<T>>;
}

export interface IItemEvent<T> extends IUIEvent {
    item: T;
}
export interface ISelectionEvent<T> extends IUIEvent {
    selectedItem: T;
}
export interface IMultiSelectionEvent<T> extends IUIEvent {
    selectedItems: T[];
    excludeItems: T[];
}
@Component({
    templateUrl: './list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListComponent<T> extends UIComponent {
    constructor(elementRef: ElementRef, renderer: Renderer2, cdr: ChangeDetectorRef) {
        super(elementRef, renderer, cdr);
    }
    @Input() dataProvider: T[] = [];
    @Input() trackBy: TrackByField | TrackByFunction<T>;
    @Input() itemLabel: ItemLabelField | ItemLabelFunction<T>;
    @Input() itemRenderer: TemplateRef<IItemRendererContext<T>>;
    @Input() itemRendererFactory: ItemRendererFactoryFunction<T>;
    @Input() selectionMode: 'default' | 'manual' = 'default';
    @Input() multiSelectionEnabled = false;

    @Input() selectedItem: T = undefined;
    @Output() selectedItemChange: EventEmitter<T> = new EventEmitter();

    @Input() selectedItems: T[] = [];
    @Output() selectedItemsChange: EventEmitter<T[]> = new EventEmitter();

    @Output() onItemClick: EventEmitter<IItemEvent<T>> = new EventEmitter();
    @Output() onSelectionChanged: EventEmitter<ISelectionEvent<T>> = new EventEmitter();
    @Output() onMultiSelectionChanged: EventEmitter<IMultiSelectionEvent<T>> = new EventEmitter();

    @ContentChild(TemplateRef) private _itemTemplateRef: TemplateRef<IItemRendererContext<T>>;
    @ViewChild('listItemWrapper', { read: TemplateRef }) private _listItemWrapper: TemplateRef<IItemRendererContext<T>>;
    @ViewChild('defaultItemRenderer', { read: TemplateRef }) private _defaultItemRenderer: TemplateRef<IItemRendererContext<T>>;
    @ViewChild(OutletComponent, { read: ViewContainerRef }) protected _itemRendererOutlet: ViewContainerRef;

    private _onItemClick(e: Event, item: T) {
        if (e.defaultPrevented) { return; }
        if (this.selectionMode === 'default') {
            this.toggleSelectedItem(item);
        }
        this._emitUIEvent(this.onItemClick, { item: item }, e);
    }
    protected _isSelected(item: T): boolean {
        if (this.multiSelectionEnabled) {
            return this.selectedItems ? (this.selectedItems.indexOf(item) !== -1) : false;
        } else {
            return this.selectedItem === item;
        }
    }
    protected _getItemTrackBy(item: T): any {
        if (!isDefined(item) || !this.trackBy) { return item; }
        return typeof this.trackBy === 'string' ? item[this.trackBy]
            : typeof this.trackBy === 'function' ? this.trackBy(item)
            : item;
    }
    protected _getItemByTrackBy(value: any): T {
        if (!isDefined(value) || !this.dataProvider) { return null; }
        return this.dataProvider.find(item => value === this._getItemTrackBy(item));
    }
    protected _getItemsTrackBy(items: T[]): any[] {
        if (!isDefined(items)) { return []; }
        return items.map(item => this._getItemTrackBy(item));
    }
    protected _getItemsByTrackBy(values: any[]): T[] {
        if (!isDefined(values) || !this.dataProvider) { return []; }
        return this.dataProvider.filter(item => values.indexOf(this._getItemTrackBy(item)));
    }
    protected _getItemLabel(item: T): string {
        return typeof this.itemLabel === 'string' ? item[this.itemLabel]
                : typeof this.itemLabel === 'function' ? this.itemLabel(item)
                : isDefined(item) ? item.toString()
                : '';
    }
    protected _getItemRendererContext(item: T, index: number): IItemRendererContext<T> {
        return {
            $implicit: item,
            item: item,
            index: index,
            selected: this._isSelected(item),
            label: this._getItemLabel(item),
            templateRef: this._getItemRendererTemplate(item)
        };
    }
    protected _getItemRendererTemplate(item: T): TemplateRef<IItemRendererContext<T>> {
        return this.itemRendererFactory ? this.itemRendererFactory(item)
                : this.itemRenderer ? this.itemRenderer
                : this._itemTemplateRef ? this._itemTemplateRef
                : this._defaultItemRenderer;
    }
    protected _shouldUpdateDisplay(changes: SimpleChanges) {
        return this._itemRendererOutlet
            && (
                'dataProvider' in changes
                || 'itemRenderer' in changes
                || 'itemRendererFactory' in changes
                || 'selectedItem' in changes
                || 'selectedItems' in changes
                || 'multiSelectionEnabled' in changes
            );
    }
    protected _updateItemRenderer(viewRef: EmbeddedViewRef<IItemRendererContext<T>>, context: IItemRendererContext<T>) {
        if (viewRef && viewRef.context && context) {
            for (const key in context) {
                if (context.hasOwnProperty(key)) {
                    if (viewRef.context[key] !== context[key]) {
                        viewRef.context[key] = context[key];
                    }
                }
            }
        }
    }
    protected _recycleItemRendererByTemplateRef(templateRef: TemplateRef<IItemRendererContext<T>>, fromIndex: number = 0): EmbeddedViewRef<IItemRendererContext<T>> {
        let viewRef: EmbeddedViewRef<IItemRendererContext<T>>;
        for (let i: number = fromIndex; i < this._itemRendererOutlet.length; i++) {
            viewRef = this._itemRendererOutlet.get(i) as EmbeddedViewRef<IItemRendererContext<T>>;
            if (viewRef && viewRef.context && viewRef.context.templateRef === templateRef) {
                return viewRef;
            }
        }
        return null;
    }
    protected _recycleItemRenderer(context: IItemRendererContext<T>, viewIndex: number) {
        let viewRef: EmbeddedViewRef<IItemRendererContext<T>>;
        for (let i: number = viewIndex; i < this._itemRendererOutlet.length; i++) {
            viewRef = this._recycleItemRendererByTemplateRef(context.templateRef, i);
            if (viewRef) {
                this._updateItemRenderer(viewRef, context);
                if (i !== viewIndex) {
                    this._itemRendererOutlet.move(viewRef, i);
                }
                return viewRef;
            }
        }
        return null;
    }
    protected _dropItemRenderer(index: number) {
        this._itemRendererOutlet.remove(index);
    }
    protected _createItemRenderer(context: IItemRendererContext<T>, viewIndex: number) {
        return this._itemRendererOutlet.createEmbeddedView(this._listItemWrapper, context, viewIndex);
    }
    protected _updateDisplay() {
        if (this._itemRendererOutlet) {
            let context;
            this.dataProvider.forEach((item: T, index: number) => {
                context = this._getItemRendererContext(item, index);
                if (!this._recycleItemRenderer(context, index)) {
                    this._createItemRenderer(context, index);
                }
            });
            // 清理超出数据集合的Renderer实例
            for (let i: number = this.dataProvider.length; i < this._itemRendererOutlet.length; i++) {
                this._dropItemRenderer(i);
            }
            this.cdr.markForCheck();
        }
    }
    protected _shouldCorrectSelectionDatas(changes: SimpleChanges) {
        return 'dataProvider' in changes
            || 'selectedItem' in changes
            || 'selectedItems' in changes
            || 'trackBy' in changes
            || 'multiSelectionEnabled' in changes;
    }
    protected _correctSelectionDatas() {
        if (this.multiSelectionEnabled) {
            this.selectedItems = this._getItemsByTrackBy(this._getItemsTrackBy(this.selectedItems));
        } else {
            this.selectedItem = this._getItemByTrackBy(this._getItemTrackBy(this.selectedItem));
        }
    }
    protected _applySelection(item: T): void {
        // TODO 局部更新
        this._updateDisplay();
        this.selectedItemChange.emit(item);
        this._emitUIEvent(this.onSelectionChanged, { selectedItem: item });
    }
    protected _applyMultiSelection(items: T[]): void {
        // TODO 局部更新
        this._updateDisplay();
        const excludeItems = this.dataProvider ? this.dataProvider.filter(item => this.selectedItems.indexOf(item) === -1) : [];
        this.selectedItemsChange.emit(items);
        this._emitUIEvent(this.onMultiSelectionChanged, { selectedItems: items, excludeItems: excludeItems });
    }
    toggleSelectedItem(item: T): void {
        if (!isDefined(item)) { return; }
        if (this.multiSelectionEnabled) {
            if (!this.selectedItems) { this.selectedItems = []; }
            const ind = this.selectedItems.indexOf(item);
            if (ind === -1) {
                this.selectedItems.push(item);
            } else {
                this.selectedItems.splice(ind, 1);
            }
            this._applyMultiSelection(this.selectedItems);
        } else {
            this.selectedItem = item;
            this._applySelection(this.selectedItem);
        }
    }
    neOnUpdate(changes: SimpleChanges) {
        super.neOnUpdate(changes);
        if (this._shouldCorrectSelectionDatas(changes)) {
            this._correctSelectionDatas();
        }
        if (this._shouldUpdateDisplay(changes)) {
            this._updateDisplay();
        }
    }
}
