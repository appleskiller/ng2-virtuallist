import {
    Component,
    ElementRef,
    Renderer2,
    ChangeDetectorRef,
    Input,
    ChangeDetectionStrategy,
    TemplateRef, ViewChild,
    ViewContainerRef,
    ComponentRef,
    SimpleChanges,
    ComponentFactoryResolver,
    ComponentFactory,
    EmbeddedViewRef,
    HostBinding,
    HostListener,
    ViewRef
} from '@angular/core';
import { UIComponent } from '../core/ui';
import { Observable } from 'rxjs';
import { ListComponent } from '../public_api';

export interface IItemRendererContext<T> {
    $implicit: T;
    item: T;
    index: number;
    label: string;
    selected: boolean;
    active: boolean;
}

export interface IItemRendererStatic<T> {
    new(): IItemRenderer<T>;
}

export interface IItemRenderer<T> {
    active: boolean;
    item: T;
    index: number;
    label: string;
    selected: boolean;
}

@Component({
    selector: 'ne-list-item',
    template: '<ng-template #outlet></ng-template>',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListItemWrapperComponent<T> extends UIComponent {
    constructor(
        public elementRef: ElementRef,
        public renderer: Renderer2,
        public cdr: ChangeDetectorRef,
        private _componentFactoryResolver: ComponentFactoryResolver
    ) {
        super(elementRef, renderer, cdr);
    }
    private _rendererRef: EmbeddedViewRef<IItemRendererContext<T>> | ComponentRef<IItemRenderer<T>>;
    @ViewChild('outlet', { read: ViewContainerRef }) protected _outlet: ViewContainerRef;
    @HostBinding('class.ne-list-item') protected _className = true;
    @HostBinding('class.selected') protected _selected = false;
    @HostListener('click', ['$event']) _onClick(e: MouseEvent) {
        if (this.owner && this.owner._onItemClick) {
            this.owner._onItemClick(e, (this.context ? this.context.item : null));
        }
    }

    context: IItemRendererContext<T>;
    itemRenderer: TemplateRef<IItemRendererContext<T>> | IItemRendererStatic<T>;
    owner: ListComponent<T>;
    active = true;
    neOnInit() {
        this._createItemRenderer(this.itemRenderer, this.context);
    }
    updateContext(context: IItemRendererContext<T>) {
        this._selected = context.selected;
        this.active = context.active;
        if (this._rendererRef) {
            if (this.itemRenderer instanceof TemplateRef) {
                this._updateEmbededViewRef(this._rendererRef as EmbeddedViewRef<IItemRendererContext<T>>, context);
            } else {
                this._updateComponetRef(this._rendererRef as ComponentRef<IItemRenderer<T>>, context);
            }
        }
        this.cdr.detectChanges();
    }
    private _createItemRenderer(itemRenderer: TemplateRef<IItemRendererContext<T>> | IItemRendererStatic<T>, context: IItemRendererContext<T>) {
        this._outlet.clear();
        if (itemRenderer) {
            if (itemRenderer instanceof TemplateRef) {
                this._rendererRef = this._outlet.createEmbeddedView(itemRenderer, context, 0);
            } else {
                const rendererFactory: ComponentFactory<IItemRenderer<T>> = this._componentFactoryResolver.resolveComponentFactory(itemRenderer as IItemRendererStatic<T>);
                this._rendererRef = this._outlet.createComponent(rendererFactory);
                this._updateComponetRef(this._rendererRef, context);
            }
        }
    }
    private _updateEmbededViewRef(ref: EmbeddedViewRef<IItemRendererContext<T>>, context: IItemRendererContext<T>) {
        if (ref && ref.context && context) {
            for (const key in context) {
                if (context.hasOwnProperty(key)) {
                    if (ref.context[key] !== context[key]) {
                        ref.context[key] = context[key];
                    }
                }
            }
        }
    }
    private _updateComponetRef(ref: ComponentRef<IItemRenderer<T>>, context: IItemRendererContext<T>) {
        if (ref) {
            const instance = ref.instance;
            for (const key in context) {
                if (context.hasOwnProperty(key)) {
                    if (instance[key] !== context[key]) {
                        instance[key] = context[key];
                    }
                }
            }
        }
    }
}

