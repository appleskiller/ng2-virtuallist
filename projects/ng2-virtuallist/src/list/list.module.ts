import { NgModule, ComponentFactoryResolver, ComponentFactory } from '@angular/core';
import { CoreModule } from '../core/core.module';
import { VirtualListComponent } from './virtual-list.component';
import { ListComponent } from './list.component';
import { CommonModule } from '@angular/common';

@NgModule({
    imports: [CommonModule, CoreModule],
    declarations: [ListComponent, VirtualListComponent],
    exports: [ListComponent, VirtualListComponent]
})
export class ListModule { }
