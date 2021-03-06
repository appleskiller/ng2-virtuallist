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
    ChangeDetectorRef,
    ComponentRef,
    OnChanges,
    HostBinding
} from '@angular/core';
import { UIComponent, IUIEvent } from '../core/ui';
import { NgTemplateOutlet } from '@angular/common';
import { OutletComponent } from '../core/outlet';
import { isDefined, moveItemTo } from '../core/utils';
import { IItemRendererContext, ListItemWrapperComponent, IItemRenderer, IItemRendererStatic } from './list-item-wrapper.component';

export type TrackByFunction<T> = (item: T) => any;
export type TrackByField = string;
export type ItemLabelFunction<T> = (item: T) => string;
export type ItemLabelField = string;
export type ItemRendererFactoryFunction<T> = (item: T) => TemplateRef<IItemRendererContext<T>> | IItemRendererStatic<T>;

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
    template: '<ng-template #outlet></ng-template>',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListComponent<T> extends UIComponent {
    constructor(
        element: ElementRef,
        renderer: Renderer2,
        cdr: ChangeDetectorRef,
        private _componentFactoryResolver: ComponentFactoryResolver
    ) {
        super(element, renderer, cdr);
    }
    private _wrapperFactory: ComponentFactory<ListItemWrapperComponent<T>> = this._componentFactoryResolver.resolveComponentFactory(ListItemWrapperComponent) as ComponentFactory<ListItemWrapperComponent<T>>;
    private _wrapperComponents: ComponentRef<ListItemWrapperComponent<T>>[] = [];
    @Input() dataProvider: T[] = [];
    @Input() trackBy: TrackByField | TrackByFunction<T>;
    @Input() itemLabel: ItemLabelField | ItemLabelFunction<T>;
    @Input() itemRenderer: TemplateRef<IItemRendererContext<T>> | IItemRendererStatic<T>;
    @Input() itemRendererFactory: ItemRendererFactoryFunction<T>;
    @Input() selectionMode: 'default' | 'manual' = 'default';
    @Input() multiSelectionEnabled = false;
    @Input() itemClass = '';

    @Input() selectedItem: T = undefined;
    @Output() selectedItemChange: EventEmitter<T> = new EventEmitter();

    @Input() selectedItems: T[] = [];
    @Output() selectedItemsChange: EventEmitter<T[]> = new EventEmitter();

    @Output() onItemClick: EventEmitter<IItemEvent<T>> = new EventEmitter();
    @Output() onSelectionChanged: EventEmitter<ISelectionEvent<T>> = new EventEmitter();
    @Output() onMultiSelectionChanged: EventEmitter<IMultiSelectionEvent<T>> = new EventEmitter();

    @ContentChild(TemplateRef) private _itemTemplateRef: TemplateRef<IItemRendererContext<T>>;
    private _defaultItemRenderer = ItemRendererComponent;
    @ViewChild('outlet', { read: ViewContainerRef }) protected _itemRendererOutlet: ViewContainerRef;

    _onItemClick(e: Event, item: T) {
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
            active: true
        };
    }
    protected _getItemRendererRef(item: T): TemplateRef<IItemRendererContext<T>> | IItemRendererStatic<T> {
        return this.itemRendererFactory ? this.itemRendererFactory(item)
                : this.itemRenderer ? this.itemRenderer
                : this._itemTemplateRef ? this._itemTemplateRef
                : this._defaultItemRenderer;
    }
    protected _shouldUpdateDisplay(changes: SimpleChanges) {
        return changes
            && this._itemRendererOutlet
            && (
                'dataProvider' in changes
                || 'itemRenderer' in changes
                || 'itemRendererFactory' in changes
                || 'selectedItem' in changes
                || 'selectedItems' in changes
                || 'multiSelectionEnabled' in changes
            );
    }
    protected _updateItemRenderer(wrapperRef: ComponentRef<ListItemWrapperComponent<T>>, item: T, viewIndex: number) {
        const instance = wrapperRef.instance;
        const context = this._getItemRendererContext(item, viewIndex);
        wrapperRef.instance.updateContext(context);
    }
    protected _recycleItemRendererByTemplateRef(rendererRef: TemplateRef<IItemRendererContext<T>> | IItemRendererStatic<T>, fromIndex: number = 0): ComponentRef<ListItemWrapperComponent<T>> {
        let wrapperRef: ComponentRef<ListItemWrapperComponent<T>>;
        for (let i: number = fromIndex; i < this._wrapperComponents.length; i++) {
            wrapperRef = this._wrapperComponents[i];
            if (wrapperRef && wrapperRef.instance.itemRenderer === rendererRef) {
                return wrapperRef;
            }
        }
        return null;
    }

    protected _recycleItemRenderer(item: T, viewIndex: number, fromIndex: number) {
        const rendererRef = this._getItemRendererRef(item);
        let wrapperRef: ComponentRef<ListItemWrapperComponent<T>>;
        for (let i: number = fromIndex; i < this._wrapperComponents.length; i++) {
            wrapperRef = this._recycleItemRendererByTemplateRef(rendererRef, i);
            if (wrapperRef) {
                if (i !== viewIndex) {
                    this._moveItemRenderer(wrapperRef, viewIndex);
                }
                this._updateItemRenderer(wrapperRef, item, viewIndex);
                return wrapperRef;
            }
        }
        return null;
    }
    protected _moveItemRenderer(wrapper: ComponentRef<ListItemWrapperComponent<T>>, viewIndex) {
        this._itemRendererOutlet.move(wrapper.hostView, viewIndex);
        moveItemTo(this._wrapperComponents, wrapper, viewIndex);
    }
    protected _dropItemRenderer(viewIndex: number) {
        const wrapper = this._wrapperComponents.splice(viewIndex, 1)[0];
        if (wrapper) {
            wrapper.destroy();
        }
    }
    protected _getItemRendererAt(viewIndex: number): ComponentRef<ListItemWrapperComponent<T>> {
        return this._wrapperComponents[viewIndex];
    }
    protected _getItemrendererLength() {
        return this._wrapperComponents.length;
    }
    protected _createItemRenderer(item: T, viewIndex: number) {
        const wrapper = this._itemRendererOutlet.createComponent(this._wrapperFactory, viewIndex);
        this._wrapperComponents.splice(viewIndex, 0, wrapper);

        wrapper.instance.active = true;
        wrapper.instance.itemRenderer = this._getItemRendererRef(item);
        wrapper.instance.context = this._getItemRendererContext(item, viewIndex);
        wrapper.instance.owner = this;
        wrapper.instance.className = this.itemClass || '';

        return wrapper;
    }
    protected _updateDisplay() {
        if (this._itemRendererOutlet) {
            this.dataProvider.forEach((item: T, index: number) => {
                if (!this._recycleItemRenderer(item, index, index)) {
                    this._createItemRenderer(item, index);
                }
            });
            // 清理超出数据集合的Renderer实例
            for (let i: number = this._itemRendererOutlet.length - 1; i >= this.dataProvider.length; i--) {
                this._dropItemRenderer(i);
            }
        }
    }
    protected _shouldCorrectSelectionDatas(changes: SimpleChanges) {
        return changes
            && ('dataProvider' in changes
            || 'selectedItem' in changes
            || 'selectedItems' in changes
            || 'trackBy' in changes
            || 'multiSelectionEnabled' in changes);
    }
    protected _correctSelectionDatas() {
        if (this.multiSelectionEnabled) {
            this.selectedItems = this._getItemsByTrackBy(this._getItemsTrackBy(this.selectedItems));
        } else {
            this.selectedItem = this._getItemByTrackBy(this._getItemTrackBy(this.selectedItem));
        }
    }
    protected _applySelection(item: T): void {
        this.selectedItemChange.emit(item);
        this._emitUIEvent(this.onSelectionChanged, { selectedItem: item });
    }
    protected _applyMultiSelection(items: T[]): void {
        const excludeItems = this.dataProvider ? this.dataProvider.filter(item => this.selectedItems.indexOf(item) === -1) : [];
        this.selectedItemsChange.emit(items);
        this._emitUIEvent(this.onMultiSelectionChanged, { selectedItems: items, excludeItems: excludeItems });
    }
    protected _updateRendererSelected(item, viewIndex, selected) {
        if (viewIndex === -1) {
            return;
        }
        const wrapper = this._wrapperComponents[viewIndex];
        wrapper.instance.updateContext({
            selected: selected,
        });
    }
    toggleSelectedItem(item: T): void {
        if (!isDefined(item)) { return; }
        let viewIndex;
        if (this.multiSelectionEnabled) {
            if (!this.selectedItems) { this.selectedItems = []; }
            const ind = this.selectedItems.indexOf(item);
            viewIndex = this.dataProvider.indexOf(item);
            if (ind === -1) {
                this.selectedItems.push(item);
                this._updateRendererSelected(item, viewIndex, true);
            } else {
                this.selectedItems.splice(ind, 1);
                this._updateRendererSelected(item, viewIndex, false);
            }
            this._applyMultiSelection(this.selectedItems);
        } else {
            viewIndex = this.dataProvider.indexOf(this.selectedItem);
            this._updateRendererSelected(this.selectedItem, viewIndex, false);
            this.selectedItem = item;
            viewIndex = this.dataProvider.indexOf(this.selectedItem);
            this._updateRendererSelected(this.selectedItem, viewIndex, true);
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

@Component({
    selector: 'ne-default-renderer',
    template: `{{label}}{{selected}}`
})
export class ItemRendererComponent<T> implements IItemRenderer<T> {
    active = true;
    item: T;
    index = -1;
    label = '';
    selected = false;
}
