# Checks every level file and tells you what to fix, with the file name and line number.
# Run it by double-clicking check.cmd. build.cmd also runs it before every build.
#   -NoWord   skip the Microsoft Word spelling and grammar pass (faster)
param([switch]$NoWord)

$ErrorActionPreference = 'Stop'
$root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8      = New-Object System.Text.UTF8Encoding($false)
$levelsDir = Join-Path $root 'levels'
$reportFile = Join-Path $root 'level-check-report.txt'

$issues = New-Object System.Collections.Generic.List[object]
$units  = New-Object System.Collections.Generic.List[object]   # text sent to Word: File, Line, Text, Grammar

function Add-Issue([string]$file, $line, [string]$level, [string]$msg, [string]$fix) {
    $issues.Add([pscustomobject]@{ File = $file; Line = $line; Level = $level; Msg = $msg; Fix = $fix })
}
function Add-Unit([string]$file, [int]$line, [string]$text, [bool]$grammar) {
    $t = ($text -replace '\s+', ' ').Trim()
    if ($t -match '[A-Za-z]{2}') { $units.Add([pscustomobject]@{ File = $file; Line = $line; Text = $t; Grammar = $grammar }) }
}
function Norm([string]$s) { return (($s -replace "[‘’ʼ]", "'") -replace '[“”]', '"' -replace '\s+', ' ').Trim() }
function Strip-Md([string]$s) {
    $s = $s -replace '!\[[^\]]*\]\([^)]*\)', ' '
    $s = $s -replace '\[([^\]]+)\]\([^)]*\)', '$1'
    $s = $s -replace '~~.+?~~', ' '
    $s = $s -replace '\*\*|`', ''
    $s = $s -replace '(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)', '$1$2'
    $s = $s -replace '^\s*(#{1,6}|>|[-*+]|\d+[.)])\s+', ''
    $s = $s -replace '^\s*[✓✔]\s*', ''
    return $s
}
function Get-Distance([string]$a, [string]$b) {
    # Edit distance between two short words, row by row.
    $prev = @(0..$b.Length)
    for ($i = 1; $i -le $a.Length; $i++) {
        $row = @($i)
        for ($j = 1; $j -le $b.Length; $j++) {
            $cost = if ($a[$i - 1] -eq $b[$j - 1]) { 0 } else { 1 }
            $del = $prev[$j] + 1; $ins = $row[$j - 1] + 1; $sub = $prev[$j - 1] + $cost
            $row += [Math]::Min([Math]::Min($del, $ins), $sub)
        }
        $prev = $row
    }
    return $prev[$b.Length]
}
function Test-Time([string]$s) { return $s -match '^\s*\d{1,2}(:\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?|noon)?\s*$' }

$SETTING_KEYS = @('title', 'level', 'document', 'type', 'pass', 'note', 'note 1', 'note 2', 'note 3', 'note fail', 'shift start', 'shift end')
$DOC_TYPES    = @('email', 'memo', 'letter', 'court filing', 'court', 'note')
$PROOF_KEYS   = @('document', 'penalty', 'hint', 'success', 'intro', 'type', 'title')
$OLD_KEYS     = @('start', 'deadline', 'fail')
$HEADER_RE    = "^\s*([A-Za-z][\w.'/()-]*(?:[ \t][\w.'/()-]+){0,2})[ \t]*:[ \t]+(.+)$"

if (-not (Test-Path $levelsDir)) { Write-Host "No 'levels' folder next to check.ps1." -ForegroundColor Red; exit 1 }

# Words Word may not know (names, legal terms). One per line in levels\words-ok.txt.
$okWords = @{}
$okFile = Join-Path $levelsDir 'words-ok.txt'
if (Test-Path $okFile) { [IO.File]::ReadAllLines($okFile, $utf8) | ForEach-Object { $w = $_.Trim(); if ($w -and -not $w.StartsWith('#')) { $okWords[$w.ToLower()] = 1 } } }

$files = @(Get-ChildItem -LiteralPath $levelsDir -Filter '*.md' -File | Sort-Object Name)
$seenIds = @{}
$dayHasName = @{}
$images = @{}
$imgDir = Join-Path $levelsDir 'images'
if (Test-Path $imgDir) { Get-ChildItem -LiteralPath $imgDir -File -Recurse | ForEach-Object { $images[('images/' + ($_.FullName.Substring($imgDir.Length + 1) -replace '\\', '/')).ToLower()] = 1 } }

function Check-SettingsKey([string]$file, [int]$ln, [string]$key, [string[]]$known) {
    $k = $key.ToLower()
    if ($known -contains $k) { return }
    # Ordinary header lines are fine as they are.
    if (@('date', 'to', 'from', 're', 'cc', 'bcc', 'subject', 'court', 'between', 'filing', 'attention', 'judicial centre', 'file no.', 'file number', 'phone', 'email') -contains $k) { return }
    foreach ($c in $known) {
        if ($k.Length -ge 3 -and (Get-Distance $k $c) -le 2) {
            $cap = $c.Substring(0, 1).ToUpper() + $c.Substring(1)
            Add-Issue $file $ln 'CHECK' "'$($key):' looks like a typo for '$($cap):'." "Change it to '$($cap):'. As written, it's shown on the document as a header line instead."
            return
        }
    }
}

function Check-Images([string]$file, [int]$ln, [string]$line) {
    foreach ($m in [regex]::Matches($line, '!\[[^\]]*\]\(([^)]*)\)')) {
        $src = $m.Groups[1].Value.Trim()
        if ($src -match '^(https?:|data:)') { continue }
        if ($src -match '\s') { Add-Issue $file $ln 'ERROR' "Picture path '$src' has a space in it." 'Rename the picture without spaces (use - instead) and update this line.'; continue }
        $key = ($src -replace '^\./', '').ToLower()
        if (-not $images.ContainsKey($key) -and -not $images.ContainsKey('images/' + $key)) {
            Add-Issue $file $ln 'ERROR' "Picture '$src' isn't in levels\images." 'Put the picture in levels\images, or fix the file name on this line.'
        }
    }
}

foreach ($f in $files) {
    $name = $f.Name
    $raw = [IO.File]::ReadAllText($f.FullName, $utf8)
    $lines = ($raw -replace "^﻿", '') -split "\r?\n"

    # FILLER left in the file
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match 'FILLER') { Add-Issue $name ($i + 1) 'CHECK' 'Still has filler text.' 'Replace this line with your own writing (or delete it).' }
    }

    # Settings block
    $meta = @{}; $bodyStart = 0
    if ($lines.Length -gt 0 -and $lines[0] -match '^\s*---\s*$') {
        $end = -1
        for ($i = 1; $i -lt $lines.Length; $i++) { if ($lines[$i] -match '^\s*---\s*$') { $end = $i; break } }
        if ($end -lt 0) { Add-Issue $name 1 'ERROR' "The settings block has no closing '---' line." "Add a line with just --- after the last setting." }
        else {
            for ($i = 1; $i -lt $end; $i++) {
                if ($lines[$i] -match '^\s*([^:]+?)\s*:\s*(.*)$') {
                    $k = $Matches[1].Trim(); $v = $Matches[2].Trim()
                    $meta[$k.ToLower()] = @{ Value = $v; Line = $i + 1 }
                    if ($name -notmatch '^(game|settings)\.md$') {
                        Check-SettingsKey $name ($i + 1) $k $SETTING_KEYS
                        if ($SETTING_KEYS -notcontains $k.ToLower()) { Add-Unit $name ($i + 1) $v $false }
                    }
                } elseif ($lines[$i].Trim()) {
                    Add-Issue $name ($i + 1) 'ERROR' "The game can't read this setting: '$($lines[$i].Trim())'." "Settings must look like 'Name: value'."
                }
            }
            $bodyStart = $end + 1
        }
    } elseif ($name -notmatch '^(game|settings)\.md$') {
        Add-Issue $name 1 'CHECK' "No settings block at the top." "Start the file with ---, then Title: ..., then ---."
    }

    # game.md
    if ($name -match '^(game|settings)\.md$') {
        foreach ($k in @('title', 'firm')) { if (-not $meta.ContainsKey($k)) { Add-Issue $name 1 'CHECK' "No '$($k.Substring(0,1).ToUpper() + $k.Substring(1)):' line." 'Add it to the settings block.' } }
        foreach ($k in @('pass', 'hearts', 'speed', 'note penalty', 'pay note', 'pay hint', 'pay document', 'pay fix', 'fine')) {
            if ($meta.ContainsKey($k) -and ($meta[$k].Value -replace '%', '') -notmatch '^\s*\d+(\.\d+)?\s*$') { Add-Issue $name $meta[$k].Line 'ERROR' "'$($meta[$k].Value)' isn't a number." 'Use a plain number, such as 3 or 50%.' }
        }
        if ($meta.ContainsKey('hearts') -and $meta['hearts'].Value -match '^\d+$' -and ([int]$meta['hearts'].Value -lt 1 -or [int]$meta['hearts'].Value -gt 5)) { Add-Issue $name $meta['hearts'].Line 'CHECK' 'Hearts must be 1 to 5.' 'The game will clamp it to that range.' }
        foreach ($k in @('shift start', 'shift end')) { if ($meta.ContainsKey($k) -and -not (Test-Time $meta[$k].Value)) { Add-Issue $name $meta[$k].Line 'ERROR' "Can't read the time '$($meta[$k].Value)'." 'Write it like 9:00 a.m.' } }
        foreach ($k in $meta.Keys) { if ($k -match '^(subtitle|ending|note|line )' -or $k -in @('note 1', 'note 2', 'note 3', 'note fail')) { $meta[$k].Value -split '//' | ForEach-Object { Add-Unit $name $meta[$k].Line $_ $true } } }
        for ($i = $bodyStart; $i -lt $lines.Length; $i++) { if ($lines[$i].Trim()) { Add-Unit $name ($i + 1) (Strip-Md $lines[$i]) $true } }
        continue
    }

    # File name
    if ($name -notmatch '^(\d+)([A-Za-z]?)(.*)\.md$') {
        Add-Issue $name 0 'ERROR' "This file won't be loaded: its name doesn't start with a number and a letter." "Rename it like '03A Lesson name.md'."
        continue
    }
    $num = [int]$Matches[1]; $id = $Matches[1] + $Matches[2].ToUpper()
    if (-not $Matches[2]) { Add-Issue $name 0 'CHECK' "The file name has no letter after the number." "Rename it like '$($Matches[1])A ...md' so the order inside the day is clear." }
    if ($seenIds.ContainsKey($id)) { Add-Issue $name 0 'ERROR' "Another file also starts with '$id' ($($seenIds[$id]))." 'Give each file its own number and letter.' } else { $seenIds[$id] = $name }
    if (-not $dayHasName.ContainsKey($num)) { $dayHasName[$num] = $false }
    if ($meta.ContainsKey('level') -and $meta['level'].Value) { $dayHasName[$num] = $true }
    if ($meta.ContainsKey('document') -and $DOC_TYPES -notcontains $meta['document'].Value.ToLower()) {
        Add-Issue $name $meta['document'].Line 'CHECK' "Unknown document type '$($meta['document'].Value)'." 'Use Email, Memo, Letter or Court filing.'
    }
    if ($meta.ContainsKey('pass') -and ($meta['pass'].Value -replace '%', '') -notmatch '^\s*\d+(\.\d+)?\s*$') { Add-Issue $name $meta['pass'].Line 'ERROR' "Pass mark '$($meta['pass'].Value)' isn't a number." 'Write it like 70%.' }
    foreach ($k in @('shift start', 'shift end')) { if ($meta.ContainsKey($k) -and -not (Test-Time $meta[$k].Value)) { Add-Issue $name $meta[$k].Line 'ERROR' "Can't read the time '$($meta[$k].Value)'." 'Write it like 9:00 a.m.' } }
    foreach ($k in @('note', 'note 1', 'note 2', 'note 3', 'note fail')) { if ($meta.ContainsKey($k)) { Add-Unit $name $meta[$k].Line $meta[$k].Value $true } }

    $body = $lines[$bodyStart..([Math]::Max($bodyStart, $lines.Length - 1))]
    if ($bodyStart -ge $lines.Length) { $body = @() }
    $isTest = $false
    if ($meta.ContainsKey('type')) { $isTest = $meta['type'].Value -match '^test' }
    else { foreach ($l in $body) { if ($l -match '^\s*((correct\s+)?answer|passage|options?)\s*:') { $isTest = $true; break } } }

    # ---------------- lesson
    if (-not $isTest) {
        if (-not ($body -join '').Trim()) { Add-Issue $name ($bodyStart + 1) 'ERROR' 'This lesson has no text.' 'Write the lesson below the settings block.' }
        if (-not $meta.ContainsKey('title')) { Add-Issue $name 1 'CHECK' "No 'Title:' line." 'Add one; it names the lesson in the rulebook.' }
        $inTable = $false
        for ($i = 0; $i -lt $body.Length; $i++) {
            $ln = $bodyStart + $i + 1; $l = $body[$i]
            if (-not $l.Trim()) { continue }
            Check-Images $name $ln $l
            if ($l -match '^\s*[✗✘]') { continue }        # a deliberately wrong example
            if ($l -match '^\s*\|') {                               # table: check spelling of each cell
                if ($l -match '^\s*\|?\s*:?-{2,}') { continue }
                ($l.Trim().Trim('|') -split '\|') | ForEach-Object { Add-Unit $name $ln (Strip-Md $_) $false }
                continue
            }
            Add-Unit $name $ln (Strip-Md $l) $true
        }
        continue
    }

    # ---------------- test
    $blocks = New-Object System.Collections.Generic.List[object]
    $cur = $null
    for ($i = 0; $i -lt $body.Length; $i++) {
        $ln = $bodyStart + $i + 1; $l = $body[$i]
        if ($l -match '^##\s+(.*)$') { $cur = [pscustomobject]@{ Title = $Matches[1].Trim(); Line = $ln; Lines = (New-Object System.Collections.Generic.List[object]) }; $blocks.Add($cur) }
        elseif ($cur) { $cur.Lines.Add([pscustomobject]@{ N = $ln; T = $l }) }
        elseif ($l.Trim()) { Add-Unit $name $ln (Strip-Md $l) $true }
    }
    if ($blocks.Count -eq 0) { Add-Issue $name ($bodyStart + 1) 'ERROR' 'This test has no blocks.' "Start each question or document with a line like '## Question'." }
    $answers = @()
    $docs = 0

    foreach ($b in $blocks) {
        $where = "'## $($b.Title)'"
        $isProof = $false; foreach ($x in $b.Lines) { if ($x.T -match '^\s*passage\s*:') { $isProof = $true; break } }

        if ($isProof) {
            # ---------- document to stamp
            $docs++
            $inPassage = $false; $errors = 0; $traps = 0; $passageLines = 0
            foreach ($x in $b.Lines) {
                $l = $x.T; $ln = $x.N
                if (-not $inPassage) {
                    if ($l -match '^\s*passage\s*:\s*(.*)$') { $inPassage = $true; $l = $Matches[1]; if (-not $l.Trim()) { continue } }
                    elseif ($l -match $HEADER_RE) {
                        $k = $Matches[1].Trim().ToLower(); $v = $Matches[2].Trim()
                        if ($OLD_KEYS -contains $k) { Add-Issue $name $ln 'NOTE' "'$($Matches[1]):' isn't used any more (the shift clock replaced it)." 'You can delete this line.' }
                        elseif ($k -eq 'penalty' -and $v -notmatch '^\d+$') { Add-Issue $name $ln 'ERROR' "Penalty '$v' isn't a whole number of minutes." 'Write it like 10.' }
                        elseif ($k -eq 'document' -and $DOC_TYPES -notcontains $v.ToLower()) { Add-Issue $name $ln 'CHECK' "Unknown document type '$v'." 'Use Email, Memo, Letter or Court filing.' }
                        elseif ($k -in @('hint', 'success', 'intro')) { Add-Unit $name $ln $v $true }
                        elseif ($PROOF_KEYS -notcontains $k) { Check-SettingsKey $name $ln $Matches[1] ($PROOF_KEYS + $OLD_KEYS); Add-Unit $name $ln $v $false }
                        continue
                    } else { if ($l.Trim()) { Add-Unit $name $ln (Strip-Md $l) $true }; continue }
                }
                # passage line
                if (-not $l.Trim()) { continue }
                $passageLines++
                $outside = [regex]::Replace($l, '\{[^{}]*\}', '')
                if ($outside -match '[{}]') { Add-Issue $name $ln 'ERROR' 'A curly bracket { or } is not closed on this line.' 'Each mark must open and close on the same line: {wrong => right}.'; continue }
                $fixed = [regex]::Replace($l, '\{([^{}]*)\}', {
                    param($m)
                    $inner = $m.Groups[1].Value; $fb = ''
                    $bar = $inner.IndexOf('|'); if ($bar -ge 0) { $fb = $inner.Substring($bar + 1).Trim(); $inner = $inner.Substring(0, $bar) }
                    $arrow = $inner.IndexOf('=>')
                    if ($arrow -lt 0) { Add-Issue $name $ln 'ERROR' "The mark {$($m.Groups[1].Value)} has no '=>'." "Write it like {wrong => right}."; return $inner }
                    $wrong = $inner.Substring(0, $arrow).Trim()
                    $rights = @($inner.Substring($arrow + 2) -split '//' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
                    if (-not $wrong) { Add-Issue $name $ln 'ERROR' "A mark has nothing before '=>'." "Mark the word next to the missing piece instead, like {Jordan => Jordan,}."; return '' }
                    $isTrap = $rights.Count -gt 0 -and @($rights | Where-Object { (Norm $_) -cne (Norm $wrong) }).Count -eq 0
                    if ($isTrap) { $script:traps++ } else { $script:errors++ }
                    if (-not $isTrap -and @($rights | Where-Object { (Norm $_) -ceq (Norm $wrong) }).Count -gt 0) {
                        Add-Issue $name $ln 'CHECK' "In {$($m.Groups[1].Value)}, one of the fixes is the same as the wrong text." 'Remove it, or make the whole mark a trap.'
                    }
                    if (-not $fb) { Add-Issue $name $ln 'NOTE' "{$wrong => ...} has no feedback after '|'." "Add one, like {$wrong => ... | why}. Players see it after fixing or missing it." }
                    else { Add-Unit $name $ln $fb $true }
                    if ($isTrap -or $rights.Count -eq 0) { if ($isTrap) { return $wrong } else { return '' } }
                    return $rights[0]
                })
                $fixed = ($fixed -replace '^\s*#\s+', '' -replace '\s{2,}', ' ' -replace '\s+([.,;:!?])', '$1')
                Add-Unit $name $ln $fixed $true
            }
            if (-not $inPassage) { Add-Issue $name $b.Line 'ERROR' "$where has no 'Passage:' line." 'Add Passage: above the text.' }
            elseif ($passageLines -eq 0) { Add-Issue $name $b.Line 'ERROR' "$where has an empty passage." 'Write the document text under Passage:.' }
            elseif ($errors -eq 0) { Add-Issue $name $b.Line 'NOTE' "$where has no errors marked, so it's a clean document (the right stamp is APPROVE)." "If it should have errors, mark them like {wrong => right}." }
            continue
        }

        # ---------- sticky note or boss note
        $q = New-Object System.Collections.Generic.List[object]
        $opts = [ordered]@{}; $optLine = @{}; $fb = @{}; $answer = $null; $answerLine = $b.Line; $hint = $null
        $started = $false; $fbMode = $false; $last = $null; $hasExplain = $false
        foreach ($x in $b.Lines) {
            $l = $x.T; $ln = $x.N
            if (-not $l.Trim()) { $last = $null; continue }
            if ($l -match '^\s*options?\s*:\s*(.*)$') {
                $started = $true; $fbMode = $false; $last = $null
                foreach ($m in [regex]::Matches($Matches[1], '([A-H])\)\s*(.*?)(?=\s*(?:[·•|]\s*)?[A-H]\)\s|$)')) {
                    $L = $m.Groups[1].Value; $t = ($m.Groups[2].Value -replace '\s*[·•|]\s*$', '').Trim()
                    if ($opts.Contains($L)) { Add-Issue $name $ln 'ERROR' "Option $L) appears twice." 'Give each option its own letter.' }
                    $opts[$L] = $t; $optLine[$L] = $ln; Add-Unit $name $ln $t $false
                }
                continue
            }
            if ($l -match '^\s*(?:correct\s+)?answer\s*:\s*(.*)$') {
                $started = $true; $fbMode = $false; $last = $null; $answerLine = $ln
                if ($Matches[1] -match '^\(?([A-Ha-h])\b') { $answer = $Matches[1].ToUpper() } else { Add-Issue $name $ln 'ERROR' "Can't read the answer '$($Matches[1])'." 'Write just the letter, like Answer: B' }
                continue
            }
            if ($l -match '^\s*feedback\s*\(?([A-Ha-h])\)?\s*:\s*(.*)$') { $started = $true; $fbMode = $false; $fb[$Matches[1].ToUpper()] = $ln; Add-Unit $name $ln $Matches[2] $true; continue }
            if ($l -match '^\s*feedback\s*:\s*$') { $started = $true; $fbMode = $true; continue }
            if ($l -match '^\s*hint\s*:\s*(.*)$') { $started = $true; $fbMode = $false; $hint = $ln; Add-Unit $name $ln $Matches[1] $true; continue }
            if ($l -match '^\s*(?:explain|explanation|why)\s*:\s*(.*)$') { $started = $true; $fbMode = $false; $hasExplain = $true; Add-Unit $name $ln $Matches[1] $true; continue }
            if ($l -match '^\s*([A-H])\)\s+(.*)$') {
                $started = $true; $L = $Matches[1]
                if ($fbMode) { $fb[$L] = $ln; Add-Unit $name $ln $Matches[2] $true }
                else {
                    if ($opts.Contains($L)) { Add-Issue $name $ln 'ERROR' "Option $L) appears twice." 'Give each option its own letter.' }
                    $opts[$L] = $Matches[2].Trim(); $optLine[$L] = $ln; Add-Unit $name $ln $Matches[2] $false
                }
                continue
            }
            if ($l -match '^\s*([a-h])\)\s+') { Add-Issue $name $ln 'CHECK' "Option letter '$($Matches[1])' is lower case." "Use a capital letter, like $($Matches[1].ToUpper())) ..." ; continue }
            if ($l -match '^\s*([A-H])[.:]\s+') { Add-Issue $name $ln 'ERROR' "The game won't read '$($Matches[1])$($l.Trim()[1])' as an option." "Write options with a bracket: $($Matches[1])) ..." ; continue }
            if (-not $started) { $q.Add([pscustomobject]@{ N = $ln; T = ($l -replace '^\s*question\s*:\s*', '') }); continue }
            Add-Issue $name $ln 'ERROR' "The game can't read this line: '$($l.Trim())'." 'Move it above the options (as part of the question) or start it with Feedback X:, Hint: or Explain:.'
        }

        if ($opts.Count -eq 0 -and -not $answer) {      # boss note
            foreach ($x in $q) { if ($x.T.Trim()) { Add-Unit $name $x.N (Strip-Md $x.T) $true } }
            continue
        }
        foreach ($x in $q) { if ($x.T.Trim()) { Add-Unit $name $x.N (Strip-Md $x.T) $false } }
        if (-not (@($q | Where-Object { $_.T.Trim() }).Count)) { Add-Issue $name $b.Line 'ERROR' "$where has no question text." 'Write the question under the ## line.' }
        if ($opts.Count -lt 2) { Add-Issue $name $b.Line 'ERROR' "$where has fewer than two options." 'Add options like A) ... and B) ... on their own lines.' }
        $letters = @($opts.Keys)
        $expected = @('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')[0..([Math]::Max(0, $letters.Count - 1))]
        if ($letters.Count -ge 2 -and (($letters -join '') -ne ($expected -join ''))) { Add-Issue $name $b.Line 'CHECK' "$where has options $($letters -join ', ') - letters skipped or out of order." 'Use A, B, C ... in order.' }
        if (-not $answer) { Add-Issue $name $b.Line 'ERROR' "$where has no 'Answer:' line." 'Add a line like Answer: B under the options.' }
        elseif (-not $opts.Contains($answer)) { Add-Issue $name $answerLine 'ERROR' "Answer is $answer, but there's no option $answer)." 'Fix the letter.' }
        else {
            $answers += $answer
            foreach ($L in $letters) {
                if ($L -ne $answer -and -not $fb.ContainsKey($L)) { Add-Issue $name $optLine[$L] 'CHECK' "No feedback for wrong option $L)." "Add 'Feedback $($L): ...'. Without it, players who pick $L) only see 'Not quite.'" }
            }
            if ($fb.ContainsKey($answer) -and -not $hasExplain) { Add-Issue $name $fb[$answer] 'NOTE' "Feedback for the right answer ($answer) is shown as the explanation." 'Fine if intended. Otherwise use Explain: for it.' }
        }
        foreach ($L in $fb.Keys) { if (-not $opts.Contains($L)) { Add-Issue $name $fb[$L] 'ERROR' "Feedback for $L), but there's no option $L)." 'Fix the letter or remove the line.' } }
        $texts = @{}; foreach ($L in $letters) { $t = (Norm $opts[$L]).ToLower(); if ($texts.ContainsKey($t)) { Add-Issue $name $optLine[$L] 'CHECK' "Options $($texts[$t])) and $L) say the same thing." 'Change one of them.' } else { $texts[$t] = $L } }
        if ($null -eq $hint) { Add-Issue $name $b.Line 'NOTE' "$where has no hint." 'Optional: add a Hint: line.' }
    }
    if ($answers.Count -ge 4 -and @($answers | Select-Object -Unique).Count -eq 1) { Add-Issue $name 0 'NOTE' "Every answer in this test is $($answers[0])." 'Players may notice the pattern. Consider mixing up the answer positions.' }
    if ($docs -eq 0 -and $blocks.Count -gt 0) { Add-Issue $name 0 'NOTE' 'This test has no document to stamp (no Passage: block).' "Fine if intended; the stamps won't be used that day." }
}

foreach ($n in $dayHasName.Keys) { if (-not $dayHasName[$n]) { Add-Issue ("Files starting with {0:D2}" -f $n) 0 'NOTE' "No 'Level:' line in any file for this day, so it's shown as just 'Day N'." "Add 'Level: Day name' to one of its files." } }

# ---------------- Microsoft Word spelling and grammar (Canadian English)
$wordStatus = ''
if ($NoWord) { $wordStatus = 'skipped (-NoWord)' }
elseif (-not [Type]::GetTypeFromProgID('Word.Application')) { $wordStatus = "skipped (Microsoft Word isn't installed)" }
elseif ($units.Count -eq 0) { $wordStatus = 'nothing to check' }
else {
    Write-Host "Checking spelling and grammar with Microsoft Word ($($units.Count) lines)..." -ForegroundColor DarkGray
    $word = $null; $doc = $null
    try {
        $word = New-Object -ComObject Word.Application
        $word.Visible = $false; $word.DisplayAlerts = 0
        $word.Options.IgnoreUppercase = $true; $word.Options.IgnoreMixedDigits = $true; $word.Options.IgnoreInternetAndFileAddresses = $true
        $doc = $word.Documents.Add()
        foreach ($group in ($units | Group-Object File)) {
            $list = @($group.Group)
            $starts = @(); $pos = 0
            foreach ($u in $list) { $starts += $pos; $pos += $u.Text.Length + 1 }
            $doc.Content.Text = ($list | ForEach-Object { $_.Text }) -join "`r"
            $doc.Content.LanguageID = 4105          # English (Canada)
            $doc.Content.NoProofing = $false
            $doc.SpellingChecked = $false; $doc.GrammarChecked = $false
            function Find-Unit([int]$at) { for ($k = $list.Count - 1; $k -ge 0; $k--) { if ($at -ge $starts[$k]) { return $list[$k] } }; return $list[0] }
            $reported = @{}
            foreach ($r in @($doc.SpellingErrors)) {
                $w = $r.Text.Trim(); if (-not $w) { continue }
                if ($okWords.ContainsKey($w.ToLower()) -or $w -cmatch '^[A-Z0-9.&-]+$') { continue }
                $u = Find-Unit $r.Start
                $key = "$($u.Line)|$w"; if ($reported.ContainsKey($key)) { continue }; $reported[$key] = 1
                if ($u.Text -match ('(?i)\b' + [regex]::Escape($w) + '\s+' + [regex]::Escape($w) + '\b')) {
                    Add-Issue $u.File $u.Line 'SPELLING' "Repeated word: '$w $w'." "Delete one, unless it's on purpose (for example, 'Is is singular' when talking about the word is)."
                    continue
                }
                $sug = @(); try { foreach ($s in $r.GetSpellingSuggestions()) { $sug += $s.Name; if ($sug.Count -ge 3) { break } } } catch { }
                $hint = if ($sug.Count) { "Word suggests: $($sug -join ', '). " } else { '' }
                Add-Issue $u.File $u.Line 'SPELLING' "'$w' may be misspelled." ($hint + "If it's correct (a name or legal term), add it to levels\words-ok.txt.")
            }
            foreach ($r in @($doc.GrammaticalErrors)) {
                $u = Find-Unit $r.Start
                if (-not $u.Grammar) { continue }
                $t = ($r.Text -replace '\s+', ' ').Trim(); if ($t.Length -gt 90) { $t = $t.Substring(0, 87) + '...' }
                $key = "$($u.Line)|$t"; if ($reported.ContainsKey($key)) { continue }; $reported[$key] = 1
                Add-Issue $u.File $u.Line 'GRAMMAR' "Word questions the grammar of: '$t'" "Check it. Word is often wrong about quoted examples and fragments, so ignore it if the sentence is right."
            }
        }
        $wordStatus = "done ($($units.Count) lines checked)"
    } catch {
        $wordStatus = "failed: $($_.Exception.Message)"
    } finally {
        if ($doc) { try { $doc.Close(0) } catch { } }
        if ($word) { try { $word.Quit() } catch { } ; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
    }
}

# ---------------- report
$order = @{ 'ERROR' = 0; 'CHECK' = 1; 'SPELLING' = 2; 'GRAMMAR' = 3; 'NOTE' = 4 }
$colour = @{ 'ERROR' = 'Red'; 'CHECK' = 'Yellow'; 'SPELLING' = 'Magenta'; 'GRAMMAR' = 'Cyan'; 'NOTE' = 'DarkGray' }
$sorted = @($issues | Sort-Object @{ e = { $_.File } }, @{ e = { [int]$_.Line } }, @{ e = { $order[$_.Level] } })
$out = New-Object System.Collections.Generic.List[string]
$out.Add("LEVEL CHECK  $(Get-Date -Format 'yyyy-MM-dd HH:mm')  -  $($files.Count) files")
$out.Add('')
Write-Host ''
Write-Host "LEVEL CHECK  -  $($files.Count) files in levels" -ForegroundColor White
foreach ($g in ($sorted | Group-Object File)) {
    Write-Host ''; Write-Host $g.Name -ForegroundColor White
    $out.Add($g.Name)
    foreach ($x in $g.Group) {
        $where = if ([int]$x.Line -gt 0) { "line $($x.Line)" } else { 'file' }
        Write-Host ("  {0,-9} {1,-9} " -f $x.Level, $where) -ForegroundColor $colour[$x.Level] -NoNewline
        Write-Host $x.Msg
        Write-Host ("                      -> " + $x.Fix) -ForegroundColor DarkGray
        $out.Add(("  {0,-9} {1,-9} {2}" -f $x.Level, $where, $x.Msg))
        $out.Add("                      -> $($x.Fix)")
    }
    $out.Add('')
}
$count = @{}; foreach ($k in $order.Keys) { $count[$k] = @($issues | Where-Object { $_.Level -eq $k }).Count }
$summary = "Errors: $($count['ERROR'])   To check: $($count['CHECK'])   Spelling: $($count['SPELLING'])   Grammar: $($count['GRAMMAR'])   Notes: $($count['NOTE'])"
Write-Host ''
if ($issues.Count -eq 0) { Write-Host 'No problems found.' -ForegroundColor Green }
Write-Host $summary -ForegroundColor $(if ($count['ERROR']) { 'Red' } elseif ($count['CHECK'] -or $count['SPELLING'] -or $count['GRAMMAR']) { 'Yellow' } else { 'Green' })
Write-Host "Word spelling and grammar: $wordStatus" -ForegroundColor DarkGray
Write-Host "Saved to level-check-report.txt" -ForegroundColor DarkGray
Write-Host ''
Write-Host 'ERROR = the game breaks or behaves wrongly.  CHECK = probably a mistake.' -ForegroundColor DarkGray
Write-Host 'SPELLING / GRAMMAR = flagged by Word (in your corrected passages, feedback and lessons).  NOTE = for your information.' -ForegroundColor DarkGray
Write-Host 'Not checked automatically: whether your answer letters and fixes are actually right. Play each changed day once.' -ForegroundColor DarkGray
$out.Add($summary); $out.Add("Word spelling and grammar: $wordStatus")
[IO.File]::WriteAllLines($reportFile, $out, $utf8)
if ($count['ERROR']) { exit 2 } else { exit 0 }
