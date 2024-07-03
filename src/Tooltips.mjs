import { computePosition, autoUpdate, offset, flip, shift, arrow } from '@floating-ui/dom';

export class MainTooltipController {
	static tooltip;
	static init(element, anchor) {
		this.tooltip._initMain(element, anchor);
	}
	static initAll(main) {
		const tooltips = main.querySelectorAll("[data-sbMainTooltip]");
		for (const tooltip of Array.from(tooltips))
			this.tooltip._initMain(tooltip);
	}
	static trigger() {
		this.tooltip._trigger();
	}
	static update(element, anchor) {
		this.tooltip._update(element, anchor);
	}
	static hide() {
		this.tooltip._hide();
	}
}
export class AltTooltipController {
	static tooltip;
	static init(element, anchor) {
		this.tooltip._initAlt(element, anchor);
	}
	static initAll(main) {
		const tooltips = main.querySelectorAll("[data-sbAltTooltip]");
		for (const tooltip of Array.from(tooltips))
			this.tooltip._initAlt(tooltip);
	}
	static trigger() {
		this.tooltip._trigger();
	}
	static update(element, anchor) {
		this.tooltip._update(element, anchor);
	}
	static hide() {
		this.tooltip._hide();
	}
}

let id = 'Main';
class Tooltip extends HTMLElement {
	_content = new DocumentFragment;
	_tooltip;
	_tooltipContent;
	_arrow;
	showFor;
	anchorFor;
	cleanUp;
	constructor() {
		super();
		const getElem = (id) => getAnyElementFromFragment(this._content, id);
		this._content = new DocumentFragment();
		this._content.append(getTemplateNode(`SkillBoosts-Tooltip`));
		this._tooltip = getElem(`sb-tooltip`);
		this._tooltipContent = getElem(`sb-tooltip-content`);
		this._arrow = getElem(`sb-tooltip-arrow`);
	}
	connectedCallback() {
		this.appendChild(this._content);
		this.id = id;
		this.id === 'Main' ? MainTooltipController['tooltip'] = this : AltTooltipController['tooltip'] = this;
		this._tooltip.classList.add(`sb-${this.id.toLowerCase()}-tooltip`);
		id = 'Alt';

		if (nativeManager.isMobile && this.id === 'Main') {
			let touch = false;
			this._tooltipContent.ontouchend = event => {
				if (touch)
					return;
				event.preventDefault();
				this._hide();
			};
			this._tooltipContent.ontouchmove = () => {
				touch = true;
			};
			this._tooltipContent.ontouchstart = () => {
				touch = false;
			};
		}
	}
	_initMain(element, anchor) {
		let timeoutId;

		let events = [
			['mouseover', () => this._show(element, anchor)],
			['mouseout', () => this._hide()],
			['focus', () => this._show(element, anchor)],
			['blur', () => {
				// Don't hide if the element blurs but any tooltip element is still hovered.
				// it would hide the tooltip from another element being hovered
				if (this.showFor && this.showFor.matches(':hover'))
					return;

				this._hide();
			}],
			['touchstart', event => {
				if (!nativeManager.isMobile)
					return;

				timeoutId = setTimeout(() => {
					timeoutId = null;
					event.preventDefault();
					event.stopPropagation();
					this.id === 'Main' ? this._show(element, anchor) : this._updateAltContent(element, anchor);
				}, 500);
			}, { passive: false }],
			['touchend', () => {
				if (!nativeManager.isMobile || !timeoutId)
					return;

				clearTimeout(timeoutId);
			}, { passive: false }],
			['touchmove', () => {
				if (!nativeManager.isMobile || !timeoutId)
					return;

				clearTimeout(timeoutId);
			}, { passive: false }],
		];
		for (const [event, listener, options] of events) {
			element.addEventListener(event, listener, options);
		}
	}
	_initAlt(element, anchor) {
		let events = [
			['contextmenu', event => {
				if (nativeManager.isMobile)
					return;
				event.preventDefault();
				this._updateAltContent(element, anchor);
			}]
		];
		for (const [event, listener, options] of events) {
			element.addEventListener(event, listener, options);
		}
	}
	_updateAltContent(element, anchor) {
		this._tooltipContent.innerHTML = '';
		this._tooltipContent.appendChild(skillBoosts.createSelection(element, element.parentElement.item));
		this._show(element, anchor);
	}
	_trigger() {
		if (this.showFor)
			this._update(this.showFor, this.anchorFor);
	}
	_update(element, anchor) {
		if (element.dataset.sbtooltipdisabled != null)
			return this._hide();

		if (this._tooltip.style.display !== 'block')
			return;

		if (element !== this.showFor)
			return;
		if (this.id === 'Main') {
			try {
				this._tooltipContent.innerHTML = '';
				let item = element.parentElement.item;
				let tooltipContent = element.querySelector('[data-sbTooltipContent]');
				if (tooltipContent)
					this._tooltipContent.innerHTML = tooltipContent.innerHTML;
				else if (element.parentElement.basicTooltip)
					this._tooltipContent.innerHTML = element.parentElement.tooltip.innerHTML;
				else
					this._tooltipContent.appendChild(skillBoosts.createTooltip(item));
			} catch (exception) {
				console.error(`Failed to update tooltip content.`, element, exception);
			}
		}

		computePosition(anchor || element, this._tooltip, {
			placement: (this.id === 'Main' ? 'top' : 'bottom'),
			middleware: [offset(this.id === 'Main' ? 8 : -8), flip(), shift({ padding: 5 }), arrow({ element: this._arrow })]
		}).then(({ x, y, placement, middlewareData }) => {
			Object.assign(this._tooltip.style, {
				left: `${x}px`,
				top: `${y}px`
			});

			const { x: arrowX, y: arrowY } = middlewareData.arrow;

			const staticSide = {
				top: 'bottom',
				right: 'left',
				bottom: 'top',
				left: 'right'
			} [placement.split('-')[0]];

			Object.assign(this._arrow.style, {
				left: arrowX != null ? `${arrowX}px` : '',
				top: arrowY != null ? `${arrowY}px` : '',
				right: '',
				bottom: '',
				[staticSide]: '-4px',
				...this._getArrowBorder(staticSide)
			});
		});
	}
	_hide() {
		this._tooltip.style.display = '';
		this.showFor = undefined;
		this.anchorFor = undefined;

		if (this.cleanUp) {
			this.cleanUp();
			this.cleanUp = undefined;
		}
	}
	_show(element, anchor) {
		if (element.dataset.mcstooltipdisabled != null)
			return;

		this.showFor = element;
		this.anchorFor = anchor;
		this._tooltip.style.display = 'block';
		this._update(element, anchor);

		this.cleanUp = autoUpdate(anchor || element, this._tooltip, () => this._update(element, anchor));
	}
	_getArrowBorder(placement) {
		const border = 'solid 1px #b3b3b3';

		const borders = {
			borderTop: '',
			borderBottom: '',
			borderLeft: '',
			borderRight: ''
		};

		switch (placement) {
			case 'top':
				borders.borderTop = border;
				borders.borderLeft = border;
				break;
			case 'bottom':
				borders.borderBottom = border;
				borders.borderRight = border;
				break;
			case 'left':
				borders.borderLeft = border;
				borders.borderBottom = border;
				break;
			case 'right':
				borders.borderTop = border;
				borders.borderRight = border;
				break;
		}

		return borders;
	}
}

customElements.define('sb-tooltip', Tooltip);