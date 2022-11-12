import Gio from 'gi://Gio';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';



export default class RedminePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Create a preferences page, with a single group
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the appearance of the extension'),
        });
        page.add(group);

        // Create url redmine entry
        const row_redmineurl = new Adw.EntryRow({
            title: _('Redmine URL'),
        });

        row_redmineurl.set_text('ok');
        group.add(row_redmineurl);

        // Create url redmine entry
        const row_redminetoken = new Adw.EntryRow({
            title: _('Redmine TOKEN'),
        });
        group.add(row_redminetoken);

        // Create a settings object and bind prefs
        window._settings = this.getSettings();
        window._settings.bind('redmine-url', row_redmineurl, 'text', Gio.SettingsBindFlags.DEFAULT);
        window._settings.bind('redmine-token', row_redminetoken, 'text', Gio.SettingsBindFlags.DEFAULT);
    }
}
