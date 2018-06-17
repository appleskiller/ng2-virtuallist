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
    $implicit?: T;
    item?: T;
    index?: number;
    label?: string;
    selected?: boolean;
    active?: boolean;
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
        element: ElementRef,
        renderer: Renderer2,
        cdr: ChangeDetectorRef,
        private _componentFactoryResolver: ComponentFactoryResolver
    ) {
        super(element, renderer, cdr);
    }
    private _rendererRef: EmbeddedViewRef<IItemRendererContext<T>> | ComponentRef<IItemRenderer<T>>;
    @ViewChild('outlet', { read: ViewContainerRef }) protected _outlet: ViewContainerRef;
    @HostListener('click', ['$event']) _onClick(e: MouseEvent) {
        if (this.owner && this.owner._onItemClick) {
            this.owner._onItemClick(e, (this.context ? this.context.item : null));
        }
    }

    context: IItemRendererContext<T>;
    itemRenderer: TemplateRef<IItemRendererContext<T>> | IItemRendererStatic<T>;
    owner: ListComponent<T>;
    active = true;
    className = '';
    neOnInit() {
        this._createItemRenderer(this.itemRenderer, this.context);
        const classMap = {
            'selected': false
        };
        if (this.className) {
            classMap[this.className] = true;
        }
        this._updateClass(classMap);
    }
    updateContext(context: IItemRendererContext<T>) {
        context = context || {};
        if ('selected' in context) {
            this._updateClass({
                'selected': !!context.selected
            });
        }
        if ('active' in context) {
            this.active = !!context.active;
        }
        this._mergeContext(this.context, context);
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
            context = context || {};
            if (itemRenderer instanceof TemplateRef) {
                this._rendererRef = this._outlet.createEmbeddedView(itemRenderer, context, 0);
            } else {
                const rendererFactory: ComponentFactory<IItemRenderer<T>> = this._componentFactoryResolver.resolveComponentFactory(itemRenderer as IItemRendererStatic<T>);
                this._rendererRef = this._outlet.createComponent(rendererFactory);
                this._updateComponetRef(this._rendererRef, context);
            }
        }
    }
    private _mergeContext(target, context) {
        for (const key in context) {
            if (context.hasOwnProperty(key)) {
                if (target[key] !== context[key]) {
                    target[key] = context[key];
                }
            }
        }
    }
    private _updateEmbededViewRef(ref: EmbeddedViewRef<IItemRendererContext<T>>, context: IItemRendererContext<T>) {
        if (ref && ref.context && context) {
            this._mergeContext(ref.context, context);
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

