import { OnDestroy, EventEmitter, Renderer2, SimpleChanges, Component, OnInit, OnChanges, SimpleChange, ElementRef, ChangeDetectorRef, AfterViewInit, AfterContentInit, Output } from '@angular/core';
import { Observable, Subject, empty, pipe } from 'rxjs';
import { takeUntil, delayWhen } from 'rxjs/operators';
import { callLater, cancelCallLater } from './utils';

export interface IUIEvent {
    target: UIComponent;
    cause?: Event | MouseEvent;
}

export class UIComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit, AfterContentInit {
    constructor(
        public element: ElementRef,
        public renderer: Renderer2,
        public cdr: ChangeDetectorRef
    ) { }
    @Output() onCreatetionCompleted: EventEmitter<void> = new EventEmitter();
    @Output() onDestroy: EventEmitter<void> = new EventEmitter();
    protected _updateClass(map: {[key: string]: boolean}): void {
        map = map || {};
        const el = this.element.nativeElement;
        const renderer = this.renderer;
        for (const key in map) {
            if (map.hasOwnProperty(key)) {
                if (map[key]) {
                    renderer.addClass(el, key);
                } else {
                    renderer.removeClass(el, key);
                }
            }
        }
    }
    protected _addClass(className: string | string[]): void {
        if (className) {
            const el = this.element.nativeElement;
            const classes = (typeof className === 'string') ? [className] : className;
            classes.forEach(key => this.renderer.addClass(el, key));
        }
    }
    protected _removeClass(className: string | string[]): void {
        if (className) {
            const el = this.element.nativeElement;
            const classes = (typeof className === 'string') ? [className] : className;
            classes.forEach(key => this.renderer.removeClass(el, key));
        }
    }
    protected _toggleClass(className: string | string[]): void {
        if (className) {
            const el = this.element.nativeElement;
            const renderer = this.renderer;
            const elClassName = ` ${el.className} `.replace(/[\t\r\n\f]/g, ' ');
            const classes = (typeof className === 'string') ? [className] : className;
            classes.forEach((key) => {
                if (elClassName.indexOf(` ${key} `) >= 0) {
                    renderer.removeClass(el, key);
                } else {
                    renderer.addClass(el, key);
                }
            });
        }
    }
    protected _emitUIEvent(emitter: EventEmitter<any>, eventData?: { [key: string]: any }, causeEvent?: Event | MouseEvent): void {
        eventData = eventData || {};
        emitter.emit({
            target: this,
            ...eventData,
            causeEvent: causeEvent
        });
    }
    protected _pipeUntilDestroy(observable$?: Observable<any>): Observable<any> {
        observable$ = observable$ || empty();
        return observable$.pipe(takeUntil(this.onDestroy));
    }
    private _callLaterIds = [];
    protected _callLater(fn) {
        this._callLaterIds.push(callLater(fn));
    }
    private _inited = false;
    private _viewInited = false;
    private _contentInited = false;
    private _creationCompleted = false;
    private _changesBeforeInit: SimpleChanges;
    neOnUpdate(changes: SimpleChanges) {}
    neOnChanges(changes: SimpleChanges) {}
    neOnInit() {}
    neOnDestroy() {}
    neOnCreationCompleted() { this.onCreatetionCompleted.emit(); this.onCreatetionCompleted.complete(); }
    ngOnInit() {
        this.neOnInit();
        this._inited = true;
        if (this._changesBeforeInit) {
            this.neOnChanges(this._changesBeforeInit);
            this.neOnUpdate(this._changesBeforeInit);
        }
        this._checkCreationCompleted();
    }
    ngOnChanges(changes: SimpleChanges) {
        if (this._inited) {
            this.neOnChanges(changes);
            this.neOnUpdate(changes);
        } else {
            this._changesBeforeInit = !this._changesBeforeInit ? changes : {
                ...this._changesBeforeInit,
                ...changes
            };
        }
    }
    ngAfterContentInit() {
        this._contentInited = true;
        this._checkCreationCompleted();
    }
    ngAfterViewInit() {
        this._viewInited = true;
        this._checkCreationCompleted();
    }
    ngOnDestroy() {
        this._callLaterIds.forEach(id => cancelCallLater(id));
        this.onDestroy.emit();
        this.onDestroy.complete();
        this.onCreatetionCompleted.complete();
        this.neOnDestroy();
    }
    private _checkCreationCompleted() {
        if (!this._creationCompleted && this._inited && this._viewInited && this._contentInited) {
            this._creationCompleted = true;
            this.neOnCreationCompleted();
        }
    }
}
