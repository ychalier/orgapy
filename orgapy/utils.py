import datetime
import random
import time


def generate_nonce() -> str:
    tokens = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
    choices = random.choices(tokens, k=12)
    return "".join(choices)


def truncate(string: str, max_length: int = 20) -> str:
    if len(string) <= max_length:
        return string
    return string[:max_length - 1] + "…"


def ravel(string: str):
    return string.replace("\n", " ")


def parse_dt(date_string: str, time_string: str) -> datetime.datetime:
    dt_date = datetime.datetime.strptime(date_string, "%Y-%m-%d").date()
    dt_time = datetime.datetime.strptime(time_string, "%H:%M").time()
    return datetime.datetime.combine(dt_date, dt_time)


def parse_date(date_string: str) -> datetime.date:
    return datetime.datetime.strptime(date_string, "%Y-%m-%d").date()


def date_timestamp(dt: datetime.datetime | datetime.date) -> int:
    if isinstance(dt, datetime.datetime):
        return int(1000 * dt.timestamp())
    return int(1000 * time.mktime(dt.timetuple()))
