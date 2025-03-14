import { mount, el } from '../../node_modules/redom/dist/redom.es';
import Button from '../atom/button.js';
import LinkButton from '../atom/link.js';
import LoginAndPasswordForm from './LoginAndPasswordForm.js';

export default class LoginForm {
    constructor() {
        this.el = this._ui_render();
    }

    _ui_render = () => {
        return (
            <div className='d-flex flex-column'>
                <LoginAndPasswordForm/>
                <Button label='Войти' className='btn-primary' />
                <LinkButton label='Зарегистрироваться'/>
            </div>
        )
    }
}