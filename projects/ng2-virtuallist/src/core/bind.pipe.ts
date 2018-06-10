import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'bind'
})
export class BindPipe implements PipeTransform {
    transform(value: any, context: any): any {
        return value.bind(context);
    }
}
