import { mount, el } from '../../node_modules/redom/dist/redom.es';
import Input from '../atom/input.js';
import Button from '../atom/button.js';
import LoginAndPasswordForm from './LoginAndPasswordForm.js';

export default class LoginForm {
    constructor() {
        this.el = this._ui_render();
    }

    _ui_render = () => {
        return (
            <div className='d-flex flex-column'>
                <LoginAndPasswordForm/>
                <Input label='Повторите пароль'/>
                <Button label='Зарегистрироваться' className='btn-primary'/>
            </div>
        )
    }
}