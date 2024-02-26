const { getResourceUrl } = mod.getContext(import.meta);
let inactiveIcon = getResourceUrl('assets/inactive.png');
class SkillBoostIcon extends ContainedComponent {
	constructor(item, media, tooltip, pillClass) {
		super();
		this.item = item;
		this.container = createElement('div', {
			className: `sb-item pointer-enabled m-1`,
		});
		this.image = this.container.appendChild(createElement('img', {
			className: `sb-img p-1`,
		}));
		this.tooltip = tippy(this.container, {
			content: tooltip,
			placement: 'top',
			allowHTML: true,
			interactive: false,
			animation: false,
		});
		if (pillClass !== undefined) {
			this.text = this.container.appendChild(createElement('span', {
				className: 'text-white pill-center justify-content-center d-flex',
			})).appendChild(createElement('small', {
				className: `badge-pill ${pillClass}`,
			}));
		}
		if (item instanceof AgilityObstacle || item instanceof AgilityPillar) {
			this.inactiveIcon = this.container.appendChild(createElement('img', {
				className: 'inactive-sb d-none',
				attributes: [
					['src', inactiveIcon]
				]
			}));
		}
		this.setImage(media);
	}
	setImage(media) {
		this.image.src = media;
	}
	setText(text) {
		this.text.textContent = text;
	}
	setTooltip(content) {
		this.tooltip.setContent(content);
	}
	destroy() {
		this.tooltip.destroy();
		this.container.remove();
	}
	hide() {
		this.container.classList.add('d-none');
	}
	show() {
		this.container.classList.remove('d-none');
	}
	setBg(style) {
		if (this.container.className.includes(style))
			return;
		this.container.classList.remove('greenBg', 'yellowBg', 'redBg', 'btn-light', 'filterBg');
		this.container.classList.add(style);
	}
	setPillbox(style) {
		if (this.text.className.includes(style))
			return;
		this.text.classList.remove('bg-secondary', 'bg-warning', 'bg-danger');
		this.text.classList.add(style);
	}
}

export { SkillBoostIcon };