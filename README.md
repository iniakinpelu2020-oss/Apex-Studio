# Apex Studio

A creative and production workspace.

**Status: not built, and honestly not defined yet.**

## Why this repo is mostly empty

"Creative and production workspace" could mean five unrelated products:

- image editing and batch conversion,
- video trimming and subtitle work,
- a design canvas for layouts and posters,
- a writing tool with export to PDF,
- an audio recorder and editor.

Each is a serious project and they share almost nothing. Building the wrong one wastes
months. So the first task here is not code, it is a sentence: **what do you actually want to
make with it?**

## A guess, to react to

If the goal is "make things for my own projects without subscriptions", the highest-value
version is probably: batch image resize and convert, plus a poster/page layout tool that
exports to PDF. Both run entirely in the browser, both are free to host, and both replace
something you would otherwise pay for.

## The constraint that shapes it

Anything that touches video needs real CPU. In a browser that means WebCodecs and a lot of
memory; a phone will struggle. Image work is comfortable. Audio is comfortable. Video is
the expensive one.

## What you need to do

1. Write down the one thing you want it to do first. Everything else follows from that.

## First three steps

1. Pick one of the five directions above.
2. Build the smallest version that replaces a tool you already use.
3. Only then decide whether the others belong in the same app.
