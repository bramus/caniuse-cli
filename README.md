# `@bramus/caniuse-cli`

Command line tool for [Can I Use](https://caniuse.com/).

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
$ caniuse webrtc
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

## Acknowledgements

This project is built on the original https://github.com/dsenkus/caniuse-cli/