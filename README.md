# `@bramus/caniuse-cli`

Command line tool for [Can I Use](https://caniuse.com/).

![npm](https://img.shields.io/npm/v/%40bramus%2Fcaniuse-cli)
![npm bundle size](https://img.shields.io/bundlejs/size/%40bramus/caniuse-cli)
![NPM](https://img.shields.io/npm/l/%40bramus/caniuse-cli)

![caniuse-cli screenshot](https://github.com/bramus/caniuse-cli/raw/main/screenshot.png?raw=true)

## Features

* Uses [caniuse-db](https://github.com/Fyrd/caniuse) internally, so results are displayed instantly.
* Supports tab autocompletion in **zsh**, **bash** and **fish**.
* Version Collapsing in the table
* Shows notes by number
* _(planned)_ MDN BCD integration

## Installation

```
# npm install -g @bramus/caniuse-cli
```

## Usage

```bash
$ caniuse viewport-units
```

## Enable Tab Autocompletion

In **zsh**:

```bash
echo '. <(caniuse --completion)' >> ~/.zshrc
```

In **bash**:

```bash
caniuse --completion >> ~/.caniuse.completion.sh
echo 'source ~/.caniuse.completion.sh' >> ~/.bashrc
```

In **fish**:

```bash
echo 'caniuse --completion-fish | source' >> ~/.config/fish/config.fish
```

That's all!

Now you have an autocompletion system. 

## Possible issues

### Missing `bash-completion` package
```
bash: _get_comp_words_by_ref: command not found
bash: __ltrim_colon_completions: command not found
bash: _get_comp_words_by_ref: command not found
bash: __ltrim_colon_completions: command not found
```

Solution: install `bash-completion` package

## License

`@bramus/caniuse-cli` is released under the MIT public license. See the enclosed `LICENSE` for details.

## Acknowledgements

This project is built on the original https://github.com/dsenkus/caniuse-cli/