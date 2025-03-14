// login.js
import { mount, el } from "../node_modules/redom/dist/redom.es";
import RegistrationForm from './widget/RegistrationForm.js';

mount(
    document.getElementById("main"),
    <RegistrationForm/>
);
