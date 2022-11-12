NAME=redmine
DOMAIN=benier.bzh
UUID=$(NAME)@$(DOMAIN)
ZIPNAME=$(UUID).shell-extension
GNOMESHELL_LINT_URL=https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/raw/main/lint
lintrules=lint/eslintrc-gjs.yml lint/eslintrc-shell.yml

.PHONY: all pack install clean

all: $(ZIPNAME).zip

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

$(ZIPNAME).zip: extension.js src/*.js schemas/gschemas.compiled
	gnome-extensions pack -f --extra-source=src

pack: $(ZIPNAME).zip

clean:
	@rm -rf $(ZIPNAME).zip

npminstall:
	npm install

$(lintrules):
	curl -s --output-dir $(dir $@) -O $(GNOMESHELL_LINT_URL)/$(notdir $@)

cleanlint:
	rm -f $(lintrules)

eslint-rules: npminstall cleanlint $(lintrules)

eslint:
	# yml files deprecated
	# see: https://eslint.org/docs/latest/use/configure/configuration-files-deprecated
	ESLINT_USE_FLAT_CONFIG=false npx eslint -c .eslintrc.yml .

install: $(ZIPNAME).zip
	gnome-extensions install $(ZIPNAME).zip

uninstall:
	gnome-extensions uninstall $(UUID)
