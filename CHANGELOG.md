# Change Log

All notable changes to the "value-cycle" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.1]

- Initial release
- Rule types: boolean, operatorPair, quote, nary, fraction, letters, hexColor, semver, constants
- No selection: target value under cursor or jump to first match on line; cursor moves to match start when jumped
- Selection: operate on selection; optional global (all matches in selection)
- Settings: `value-cycle.rules`, `value-cycle.disabledTypes`
- No default keybindings