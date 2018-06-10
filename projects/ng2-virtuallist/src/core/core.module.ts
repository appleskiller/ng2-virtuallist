import { NgModule } from '@angular/core';
import { UIComponent } from './ui';
import { OutletComponent } from './outlet';
import { BindPipe } from './bind.pipe';

@NgModule({
    imports: [],
    declarations: [OutletComponent, BindPipe],
    exports: [OutletComponent, BindPipe]
})
export class CoreModule { }
