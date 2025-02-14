// login.js
import { mount, el } from "../node_modules/redom/dist/redom.es";
import LoginPage from './components/LoginPage.jsx';

console.log(document.getElementById("main"));

mount(
    document.getElementById("main"),
    new LoginPage()
);