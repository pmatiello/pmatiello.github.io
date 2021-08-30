#!/bin/zsh

eval "$(rbenv init -)"
ruby -v
bundle exec jekyll serve --watch --config _config.yml,_devconfig.yml
