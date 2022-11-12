import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';

import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as RedMenu from './menu.js';
import * as Utils from './utils.js';

const INDICATORNAME = 'RedmineIndicator';

export const Indicator = GObject.registerClass({
    GTypeName: INDICATORNAME,
    Signals: {
        'newissueid': {param_types: [GObject.TYPE_INT]},
        'refresh': {},
    },
}, class Indicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, INDICATORNAME);
        this.extension = extension;
        this._settings = extension.getSettings();

        this._build_menu();
    }

    destroy() {
        this.extension = null;
        this._settings = null;

        super.destroy();
    }

    _build_menu() {
        // Add an icon
        const icon = new St.Icon({
            icon_name: RedMenu.ICON_NOTRECORDING,
            style_class: 'system-status-icon',
        });
        this.add_child(icon);

        // redefine _setOpenedSubMenu to avoid closing submenu
        this.menu._setOpenedSubMenu = function (_menu) {};

        // add global icon buttons
        const menuitem = new RedMenu.ButtonsItem([
            {'name': RedMenu.ICON_REFRESH, 'cb': () => this.emit('refresh')},
            {'name': RedMenu.ICON_SETTINGS, 'cb': () => this.extension.openPreferences()},
        ]);
        this.menu.addMenuItem(menuitem);

        console.debug(`START width=${this.menu.width}`);

        this.record_menu = new PopupMenu.PopupSubMenuMenuItem('Record', true);
        this.record_menu.menu.open(true);
        this.menu.addMenuItem(this.record_menu);

        // label that do the sum of all records
        this.btn_all_records = new St.Button({
            reactive: true,
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
            can_focus: true,
            track_hover: true,
            style_class: 'popup-button',
        });
        this._btn_all_records_signal = null;
        this._btn_all_records_url = null;

        this.record_menu.insert_child_above(this.btn_all_records, this.record_menu.label);

        // pinned menu: disable for now
        this.pinned_menu = new PopupMenu.PopupSubMenuMenuItem('Pinned', true);
        this.pinned_menu.menu.open(true);
        // this.menu.addMenuItem(this.pinned_menu);

        // issues menu
        this.issues_menu = new PopupMenu.PopupSubMenuMenuItem('Issues', true);
        this.menu.addMenuItem(this.issues_menu);
        this.load_more_items = new RedMenu.LoadMoreItem(() => {
            this._nb_issues += 10;
            this._updateissues();
            this.issues_menu.menu.isOpen = false;
            this.issues_menu.setSubmenuShown(true);
        });
        this.issue_entry = new St.Entry({
            hint_text: 'add issue',
            style_class: 'time-entry',
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.END,
        });
        this.issues_menu.insert_child_above(this.issue_entry, this.issues_menu.label);
        // text-changed(text)
        this.issue_entry.get_clutter_text().connect('activate', text => this.send_newissueid(text.get_text()));
        // disable load_more_items for now
        // this.issues_menu.menu.addMenuItem(this.load_more_items);

        // projects menu
        this.projects_menu = new PopupMenu.PopupSubMenuMenuItem('Projects', true);
        this.menu.addMenuItem(this.projects_menu);

        // open menus
        this.menu.connect('open-state-changed', (menu, open) => {
            this.issues_menu.setSubmenuShown(open);
            this.record_menu.setSubmenuShown(open);
        });
    }

    set_url_all_records(url) {
        if (url === this._btn_all_records_url)
            return;

        if (this._btn_all_records_signal)
            this.btn_all_records.disconnect(this._btn_all_records_signal);

        // open url on record button
        this._btn_all_records_signal = this.btn_all_records.connect('clicked', () => {
            Util.spawn(['xdg-open', url]);
        });
        this._btn_all_records_url = url;
    }

    set_time_all_records(time) {
        this.btn_all_records.set_label(Utils.get_time_hh_mm(time));
    }

    send_newissueid(text) {
        let issueid = Number(text);
        if (isNaN(issueid)) {
            Utils.notify_warn(`Issue id ${text} is not a number`);
            return;
        }

        this.emit('newissueid', issueid);

        // unclear text
        this.issue_entry.set_text('');
    }

    add_project(dataitem) {
        let item = new RedMenu.ProjectItem(dataitem);
        this.projects_menu.menu.addMenuItem(item);
        return item;
    }

    add_issue(dataitem) {
        let item = new RedMenu.IssueItem(dataitem);
        this.issues_menu.menu.addMenuItem(item);
        return item;
    }

    add_record(dataitem) {
        return new RedMenu.RecordActivityItem(this.record_menu.menu, dataitem);
    }
});
