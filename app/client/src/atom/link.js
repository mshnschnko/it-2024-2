import { el, text } from '../../node_modules/redom/dist/redom.es';

export class LinkButton {
  constructor() {
    this.el = el('a.link-button');
    this._children = [];
  }
  
  update({ href, className }, children) {
    this.el.href = href || '#';
    this.el.className = `link-button ${className || ''}`.trim();
    
    this.el.innerHTML = '';
    
    this._children = children.map(child => {
      if (typeof child === 'string') {
        return text(child);
      }
      return child;
    });
    
    this._children.forEach(child => this.el.appendChild(child));
    
    return this.el;
  }
}

export const linkButton = (props, ...children) => {
  const component = new LinkButton();
  return component.update(props, children.flat());
};