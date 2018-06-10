import { Component } from '@angular/core';

let count = 0;
function createDatas(amount = 200) {
    const result = [];
    for (let i = 0; i < amount; i++) {
        count++;
        result.push(`item_${count}`);
    }
    return result;
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent {
    title = 'app';
    datas = ['A', 'B', 'C'];
    virtualListDatas = createDatas();
    _resetDatas() {
        this.datas = ['B', 'B', 'C'];
    }
}
