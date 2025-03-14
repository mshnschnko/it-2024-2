import { mount, el, text } from '../../node_modules/redom/dist/redom.es';
import LoginAndPasswordForm from './LoginAndPasswordForm.js';
import Button from '../atom/button.js';
import { linkButton as LinkButton } from '../atom/link.js';

export default class LoginForm {
    constructor() {
        this.el = this._ui_render();
    }

    _ui_render = () => {
        return (
            <div className='d-flex flex-column'>
                <LoginAndPasswordForm/>
                <Button label='Войти' className='btn-primary' />
                <LinkButton href='/register'>
                    {text('Зарегистрироваться')}
                </LinkButton>
            </div>
        )
    }
}