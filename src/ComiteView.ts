import { ItemView, WorkspaceLeaf } from "obsidian";
import type ComitePlugin from "./main";

export const COMITE_VIEW_TYPE = "comite-patrimonial-view";

export class ComiteView extends ItemView {
	constructor(leaf: WorkspaceLeaf, private plugin: ComitePlugin) {
		super(leaf);
	}

	getViewType() {
		return COMITE_VIEW_TYPE;
	}

	getDisplayText() {
		return "Colbert";
	}

	getIcon() {
		return "scale";
	}

	async onOpen() {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.createEl("h3", { text: "Colbert" });
		root.createEl("p", { text: "UI à venir (étape 4)." });
	}

	async onClose() {}
}
