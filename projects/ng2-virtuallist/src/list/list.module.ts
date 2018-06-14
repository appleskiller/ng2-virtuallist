import { NgModule, ComponentFactoryResolver, ComponentFactory } from '@angular/core';
import { CoreModule } from '../core/core.module';
import { VirtualListComponent } from './virtual-list.component';
import { ListComponent, ItemRendererComponent } from './list.component';
import { CommonModule } from '@angular/common';
import { ListItemWrapperComponent } from './list-item-wrapper.component';

@NgModule({
    imports: [CommonModule, CoreModule],
    declarations: [ListComponent, VirtualListComponent, ListItemWrapperComponent, ItemRendererComponent],
    exports: [ListComponent, VirtualListComponent, ListItemWrapperComponent, ItemRendererComponent],
    entryComponents: [ListItemWrapperComponent, ItemRendererComponent]
})
export class ListModule { }
