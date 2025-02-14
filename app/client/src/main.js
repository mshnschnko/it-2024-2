// main.js
import { mount, unmount } from '../node_modules/redom/dist/redom.es';
import LoginPage from './components/LoginPage.jsx';
import RegistrationPage from './components/RegistrationPage.jsx';

let currentPage;

function showLoginPage() {
    if (currentPage) unmount(document.getElementById('main'), currentPage);
    currentPage = new LoginPage();
    mount(document.getElementById('main'), currentPage);

    document.getElementById('go-to-registration')?.addEventListener('click', (e) => {
        e.preventDefault();
        showRegistrationPage();
    });
}

function showRegistrationPage() {
    if (currentPage) unmount(document.getElementById('main'), currentPage);
    currentPage = new RegistrationPage();
    mount(document.getElementById('main'), currentPage);

    document.getElementById('go-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPage();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    showLoginPage();
});
