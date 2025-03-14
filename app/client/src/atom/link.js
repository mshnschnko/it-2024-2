import { mount, el } from '../../node_modules/redom/dist/redom.es';

export default class LinkButton {
    constructor(settings = {}) {
        const { label, className = '' } = settings;
        this._prop = { label, className };
        this.el = this._ui_render();
    }

    _ui_render = () => {
        const { label, className } = this._prop;
        return (
            <a href="#" className={`link-button ${className}`.trim()}>
                {label}
            </a>
        )
    }
}