APPID = com.palm.service.pebble

.PHONY: install run clobber clean

all: package

service:
	$(MAKE) -C src

package: service
	palm-package -X excludes.txt .
	ar q ${APPID}_*.ipk pmPostInstall.script
	ar q ${APPID}_*.ipk pmPreRemove.script

install:
	palm-install ${APPID}_*.ipk

run: install
	palm-launch ${APPID}

clobber:
	rm -rf build *.ipk

clean: clobber
