// LoginPage.jsx
import { mount, el } from '../../node_modules/redom/dist/redom.es';

class LoginPage {
    constructor() {
        this.el = (
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-header text-center">
                                <h3>Вход</h3>
                            </div>
                            <div className="card-body">
                                <form>
                                    <div className="mb-3">
                                        <label htmlFor="email" className="form-label">Email</label>
                                        <input type="email" id="email" className="form-control" placeholder="Введите email" />
                                    </div>
                                    <div className="mb-3">
                                        <label htmlFor="password" className="form-label">Пароль</label>
                                        <input type="password" id="password" className="form-control" placeholder="Введите пароль" />
                                    </div>
                                    <div className="d-grid gap-2">
                                        <button type="submit" className="btn btn-primary">Войти</button>
                                    </div>
                                </form>
                                <div className="text-center mt-3">
                                    <a href="#" id="go-to-registration" className="link-primary">Нет аккаунта? Зарегистрироваться</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default LoginPage;
