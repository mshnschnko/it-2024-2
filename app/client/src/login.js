// login.js
import { mount, el } from "../node_modules/redom/dist/redom.es";
import LoginForm from './widget/LoginForm.js';

mount(
    document.getElementById("main"),
    <LoginForm/>
);
