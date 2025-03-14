import { mount, el } from '../../node_modules/redom/dist/redom.es';
import Input from '../atom/input.js';

export default class LoginAndPasswordForm {
    constructor() {
        this.el = this._ui_render();
    }

    _ui_render = () => {
        return (
            <div className='d-flex flex-column'>
                <Input label='Логин'/>
                <Input label='Пароль'/>
            </div>
        )
    }
}