import { App, PluginSettingTab, Setting } from "obsidian";
import type ComitePlugin from "./main";

export interface ComiteSettings {
	scriptPath: string;
	claudeBin: string;
	committeesDir: string;
	finalReportsDir: string;
	logsDir: string;
}

export const DEFAULT_SETTINGS: ComiteSettings = {
	scriptPath: "",
	claudeBin: "",
	committeesDir: "06 - Analyses/Committees",
	finalReportsDir: "06 - Analyses/Final Reports",
	logsDir: "99 - LLM/Logs",
};

export class ComiteSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ComitePlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Chemin de committee.sh")
			.setDesc("Chemin absolu vers 99 - LLM/scripts/committee.sh")
			.addText((t) =>
				t
					.setPlaceholder("/Users/.../99 - LLM/scripts/committee.sh")
					.setValue(this.plugin.settings.scriptPath)
					.onChange(async (v) => {
						this.plugin.settings.scriptPath = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Binaire claude (optionnel)")
			.setDesc("Si vide, le PATH sera étendu à /usr/local/bin et /opt/homebrew/bin")
			.addText((t) =>
				t
					.setPlaceholder("/opt/homebrew/bin/claude")
					.setValue(this.plugin.settings.claudeBin)
					.onChange(async (v) => {
						this.plugin.settings.claudeBin = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Dossier des bootstraps")
			.setDesc("Chemin relatif au vault (où committee.sh cherche committee-bootstrap-*.md)")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.committeesDir)
					.onChange(async (v) => {
						this.plugin.settings.committeesDir = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Dossier des Final Reports")
			.setDesc("Chemin relatif au vault (où le rapport final est écrit)")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.finalReportsDir)
					.onChange(async (v) => {
						this.plugin.settings.finalReportsDir = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Dossier des logs / runs")
			.setDesc("Chemin relatif au vault (contient runs/<...>/ et les .log)")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.logsDir)
					.onChange(async (v) => {
						this.plugin.settings.logsDir = v.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}
