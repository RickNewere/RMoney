# 💸 RMoney

A private expense tracker for two people, Riccardo and Roberta, who share some costs and keep separate accounts in euros and Swiss francs. Everything is stored in a shared Google spreadsheet, so the numbers stay in a place both people already use.

Available on iPhone as a home screen web app and on Android as an installable app. Both show the same screens.

## Adding an expense

Pick who is spending and which account, then fill in date, amount, category and an optional note. Categories are read from the spreadsheet itself, so the list always matches what is already in use.

Amounts go into the right tab automatically based on the person and the currency selected.

## Shared expenses

Any expense can be marked as shared, meaning it is split in half between the two people. The app keeps a running count of these and shows:

- how much the other person owes for the expenses on the current tab
- the net balance per currency, so you see a single figure and who owes it

When the balance is settled, one button clears all the shared marks for that tab. The expenses themselves are never removed, only the shared flag.

## Home screen widget

On Android the app comes with a home screen widget that shows the shared balance without opening anything: how much is still owed in euros and in francs, and who owes it. It refreshes on its own every half hour, and tapping the time in the corner forces a refresh straight away. Tapping anywhere else opens the app.

If the phone is offline the widget keeps showing the last figure it managed to read, marked as old, rather than going blank.

The widget is Android only. On iPhone the app runs as a web app on the home screen, which cannot provide widgets.

## Summary

A separate summary view answers the question of where the money went. You choose the period, either a full year or a single month, and the currency, euros or francs.

It shows:

- income, spending and savings for Riccardo, for Roberta, and for the two combined
- a breakdown of spending against income for each person
- how savings moved month by month across the year
- spending by category, viewable for one person at a time or for both together, with each category's share of the total

Everything is recalculated from the actual entries for the period selected, so any month or year can be inspected, not just the current one.

## Language

The interface is in Italian.
