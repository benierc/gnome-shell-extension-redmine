/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';


import {Indicator} from './src/indicator.js';
import {Manager} from './src/manager.js';

export default class RedmineExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this);

        // Add the indicator to the panel
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._manager = new Manager(this, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._manager?.destroy();
        this._indicator = null;
        this._manager = null;
    }
}

