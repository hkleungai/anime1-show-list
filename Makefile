.PHONY: build watch clean

build:
	$(RUN) $(INPUT)

watch:
	$(RUN) $(WATCH_PATH) $(INPUT)

clean:
	rm -rf $(DIST)

# -----------------------------------------------------------------------------

DISABLE_WARNING = \
	--disable-warning="DEP0180" \
	--disable-warning="ExperimentalWarning"

DIST = dist

ENV = TS_NODE_PRETTY=true

IMPORT = --import="data:text/javascript,								\
	import { register } from 'node:module';								\
	import { setUncaughtExceptionCaptureCallback } from 'node:process';	\
	import { pathToFileURL } from 'node:url';							\
																		\
	setUncaughtExceptionCaptureCallback(console.error);					\
																		\
	const import_url = pathToFileURL(import.meta.url).href;				\
	register('ts-node/esm', import_url);								\
"

# INPUT = User input. Should be a single typescript file.

NODE = node

RUN = $(ENV) $(NODE) $(IMPORT) $(DISABLE_WARNING)

WATCH_PATH = --watch-path=src
