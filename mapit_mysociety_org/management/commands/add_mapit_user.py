import re

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
import stripe

from api_keys.models import APIKey
from subscriptions.models import Subscription

stripe.api_key = settings.STRIPE_SECRET_KEY


class Command(BaseCommand):
    help = "Create a new user with associated Stripe subscription"

    def add_arguments(self, parser):
        plans = stripe.Plan.list()
        plan_ids = [plan['id'] for plan in plans.data if plan['id'].startswith('mapit')]
        coupons = stripe.Coupon.list()
        self.coupon_ids = [coupon['id'] for coupon in coupons if coupon['id'].startswith('charitable')]
        parser.add_argument('--email', required=True)
        parser.add_argument('--plan', choices=plan_ids, required=True)
        parser.add_argument('--coupon', help='Existing coupons: ' + ', '.join(self.coupon_ids))
        parser.add_argument('--trial', type=int)

    def handle(self, *args, **options):
        email = options['email']
        coupon = options['coupon']
        plan = options['plan']

        if coupon not in self.coupon_ids:
            # coupon ID of the form charitableN(-Nmonths)
            m = re.match(r'charitable(\d+)(?:-(\d+)month)?', coupon)
            if not m:
                raise CommandError("Coupon not in correct format")
            percent_off, months = m.groups()
            args = {'duration': 'forever'}
            if months:
                args = {'duration': 'repeating', 'duration_in_months': months}
            stripe.Coupon.create(
                id=coupon,
                percent_off=percent_off,
                **args
            )

        username = email[:25]
        password = User.objects.make_random_password(length=20)
        user = User.objects.create_user(username, email, password=password)
        api_key = APIKey.objects.create(user=user, key=APIKey.generate_key())

        customer = stripe.Customer.create(email=email).id
        stripe_sub = stripe.Subscription.create(
            customer=customer, plan=plan, coupon=coupon, trial_period_days=options['trial']).id

        sub = Subscription.objects.create(user=user, stripe_id=stripe_sub)
        sub.redis_update_max(plan)

        self.stdout.write("Created user %s with password %s, API key %s\n" % (username, password, api_key.key))
