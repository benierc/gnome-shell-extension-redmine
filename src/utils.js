/* eslint-disable jsdoc/require-jsdoc */
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';


export function notify_error(msg) {
    console.error(_(`${msg}`));
    Main.notify('redmine', _(`${msg}`));
}

export function error(err) {
    notify_error(err);
    console.log(err.stack);
}

export function notify_warn(msg) {
    console.warn(_(`${msg}`));
    Main.notify('redmine', _(`${msg}`));
}

export function get_time_hh_mm(time_hours) {
    let hours = parseInt(time_hours);
    let minutes = parseInt((time_hours - hours) * 60);
    let time_str = `${hours}:`;
    if (minutes < 10)
        time_str += '0';
    time_str += `${minutes}`;
    return time_str;
}
