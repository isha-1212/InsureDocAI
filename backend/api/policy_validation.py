import re
from datetime import date, datetime, timedelta
from typing import Any

from rest_framework import serializers


POLICY_NUMBER_REGEX = re.compile(r"^INS-(?P<year>\d{4})-(?P<plan_type>FAM|IND)-(?P<sequence>\d{6})$")
MIN_POLICY_YEAR = 2000
MIN_POLICY_DURATION_DAYS = 364
MAX_POLICY_DURATION_DAYS = 366


def _parse_date_strict(value: Any, field_name: str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        raise serializers.ValidationError({field_name: f"{field_name.replace('_', ' ').title()} must be a valid date"})

    try:
        return date.fromisoformat(value)
    except ValueError:
        raise serializers.ValidationError({field_name: f"{field_name.replace('_', ' ').title()} must be a valid date"})


def _add_one_year(value: date) -> date:
    try:
        return value.replace(year=value.year + 1)
    except ValueError:
        return value.replace(month=2, day=28, year=value.year + 1)


def parse_policy_number(policy_number: str) -> dict[str, Any]:
    if not isinstance(policy_number, str) or not policy_number:
        raise serializers.ValidationError({"policy_number": "Policy number is required"})

    if policy_number != policy_number.strip():
        raise serializers.ValidationError({"policy_number": "Policy number cannot contain leading or trailing spaces"})

    if " " in policy_number:
        raise serializers.ValidationError({"policy_number": "Policy number cannot contain spaces"})

    if policy_number != policy_number.upper():
        raise serializers.ValidationError({"policy_number": "Policy number must be uppercase"})

    match = POLICY_NUMBER_REGEX.fullmatch(policy_number)
    if not match:
        raise serializers.ValidationError({
            "policy_number": "Policy number must match format INS-YYYY-(FAM|IND)-XXXXXX"
        })

    policy_year = int(match.group("year"))
    current_year = date.today().year
    if policy_year < MIN_POLICY_YEAR or policy_year > current_year:
        raise serializers.ValidationError({
            "policy_number": f"Policy number year must be between {MIN_POLICY_YEAR} and {current_year}"
        })

    sequence = int(match.group("sequence"))
    if sequence < 1:
        raise serializers.ValidationError({
            "policy_number": "Policy number sequence must be between 000001 and 999999"
        })

    return {
        "normalized": policy_number,
        "year": policy_year,
        "plan_type": match.group("plan_type"),
        "sequence": match.group("sequence"),
    }


def validate_policy_payload(
    *,
    policy_number: Any,
    start_date_value: Any,
    end_date_value: Any,
    family_members: list[Any] | None = None,
) -> dict[str, Any]:
    parsed_policy = parse_policy_number(policy_number)
    start_date = _parse_date_strict(start_date_value, "start_date")
    end_date = _parse_date_strict(end_date_value, "end_date")
    today = date.today()

    if start_date > today:
        raise serializers.ValidationError({
            "start_date": "Start date cannot be in the future"
        })

    if end_date <= start_date:
        raise serializers.ValidationError({
            "end_date": "End date must be greater than start date"
        })

    coverage_days = (end_date - start_date).days
    if coverage_days < MIN_POLICY_DURATION_DAYS or coverage_days > MAX_POLICY_DURATION_DAYS:
        raise serializers.ValidationError({
            "end_date": "End date must be within 364 to 366 days from the start date"
        })

    latest_allowed_end_date = _add_one_year(today)
    if end_date > latest_allowed_end_date:
        raise serializers.ValidationError({
            "end_date": f"End date cannot be later than {latest_allowed_end_date.isoformat()}"
        })

    if parsed_policy["year"] != start_date.year:
        raise serializers.ValidationError({
            "policy_number": "Policy number year must match the start date year"
        })

    if family_members and parsed_policy["plan_type"] == "IND":
        raise serializers.ValidationError({
            "family_members": "Individual plan policies cannot include family members"
        })

    return {
        "policy_number": parsed_policy["normalized"],
        "policy_year": parsed_policy["year"],
        "plan_type": parsed_policy["plan_type"],
        "start_date": start_date,
        "end_date": end_date,
        "coverage_days": coverage_days,
    }
