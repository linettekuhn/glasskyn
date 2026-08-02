import calendar
from datetime import date


def add_months(d: date, months: int) -> date:
    """Add a number of months to a date, clamping the day to the target month."""
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def compute_expiry_date(opened_date: date | None, pao_months: int | None) -> date | None:
    """Compute expiry = opened_date + pao_months."""
    if not opened_date or not pao_months:
        return None
    return add_months(opened_date, pao_months)


def days_until_expiry(expiry_date: date | None, today: date | None = None) -> int | None:
    if not expiry_date:
        return None
    today = today or date.today()
    return (expiry_date - today).days
