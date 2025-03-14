import { mount, el } from '../../node_modules/redom/dist/redom.es';

export default class Button {
    constructor(settings = {}) {
        const { label, className = '' } = settings;
        this._prop = { label, className };
        this.el = this._ui_render();
    }

    _ui_render = () => {
        const { label, className } = this._prop;
        return (
            <div>
                <button className={`btn ${className}`.trim()}>
                    {label}
                </button>
            </div>
        )
    }
}