(function() {

function plan_cost() {
  var plan = document.querySelector('input[name=plan]:checked'),
    ctick = document.getElementById('id_charitable_tick'),
    c = document.querySelector('input[name=charitable]:checked');
  plan = plan ? plan.value : '';
  ctick = ctick ? ctick.checked : '';
  c = c ? c.value : '';
  var num = 20;
  if (plan === 'mapit-100k-v') {
    num = 100;
  } else if (plan === 'mapit-0k-v') {
    num = 300;
  }
  if (ctick) {
    if (c === 'c' || c === 'i') {
      if (num === 20) {
        num = 0;
      } else {
        num = num / 2;
      }
    }
  }
  return num;
}

function need_stripe() {
  var num = plan_cost();
  if (num === 0 || document.getElementById('js-payment').getAttribute('data-has-payment-data')) {
    return false;
  }
  return true;
}

function toggle_stripe() {
  var div = document.getElementById('js-payment-needed');
  if (!div) { return; }
  if (need_stripe()) {
    div.style.display = 'block';
  } else {
    div.style.display = 'none';
  }
}

if (document.getElementById('id_plan_0')) {
  document.getElementById('id_plan_0').addEventListener('change', toggle_stripe);
  document.getElementById('id_plan_1').addEventListener('change', toggle_stripe);
  document.getElementById('id_plan_2').addEventListener('change', toggle_stripe);
  document.getElementById('id_charitable_tick').addEventListener('click', function(e) {
    if (this.checked) {
        document.getElementById('charitable-qns').style.display = 'block';
    } else {
        document.getElementById('charitable-qns').style.display = 'none';
    }
    toggle_stripe();
  });
  document.getElementById('id_charitable_0').addEventListener('change', function(e) {
    document.getElementById('charitable-neither').style.display = 'none';
    document.getElementById('charitable-desc').style.display = 'none';
    document.getElementById('charity-number').style.display = 'block';
    toggle_stripe();
  });
  document.getElementById('id_charitable_1').addEventListener('change', function(e) {
    document.getElementById('charity-number').style.display = 'none';
    document.getElementById('charitable-neither').style.display = 'none';
    document.getElementById('charitable-desc').style.display = 'block';
    toggle_stripe();
  });
  document.getElementById('id_charitable_2').addEventListener('change', function(e) {
    document.getElementById('charitable-neither').style.display = 'block';
    document.getElementById('charity-number').style.display = 'none';
    document.getElementById('charitable-desc').style.display = 'none';
    toggle_stripe();
  });
}

toggle_stripe();

var stripe_key = document.getElementById('js-payment').getAttribute('data-key');
var stripe = Stripe(stripe_key);
var elements = stripe.elements();
var card = elements.create('card');
if (document.getElementById('card-element')) {
    card.mount('#card-element');
}

function showError(msg) {
  var displayError = document.getElementById('card-errors');
  displayError.innerHTML = msg ? '<div class="account-form__errors">' + msg + '</div>' : '';
}
card.addEventListener('change', function(event) {
  showError(event.error ? event.error.message : '');
});

function err_highlight(labelElement, err) {
  var $field = $(labelElement).closest('.account-form__field');
  if (err) {
    $field.addClass('account-form__field--error');
    return 1;
  } else {
    $field.removeClass('account-form__field--error');
    return 0;
  }
}

function err(field, extra) {
  var f = document.getElementById(field);
  if (!f) {
    return 0;
  }
  f = f.value;
  var label = document.querySelector('label[for=' + field + ']');
  return err_highlight(label, extra !== undefined ? extra && !f : !f);
}

var form = document.getElementById('signup_form');
form && form.addEventListener('submit', function(e) {
  // Already got a token from Stripe (so password mismatch error or somesuch)
  if (this.stripeToken.value) {
      return;
  }
  e.preventDefault();

  var errors = 0;
  errors += err('id_email');
  errors += err('id_password');
  errors += err('id_password_confirm');
  var plan = document.querySelector('input[name=plan]:checked');
  errors += err_highlight(document.querySelector('label[for=id_plan_0]'), !plan);
  var ctick = document.getElementById('id_charitable_tick').checked;
  var c = document.querySelector('input[name=charitable]:checked');
  errors += err_highlight(document.querySelector('label[for=id_charitable_0]'), ctick && !c);
  errors += err('id_charity_number', ctick && c && c.value === 'c');
  errors += err('id_description', ctick && c && c.value === 'i');
  var tandcs = document.getElementById('id_tandcs_tick');
  errors += tandcs && err_highlight(tandcs.parentNode, !tandcs.checked);
  if (errors) {
    return;
  }

  if (!need_stripe()) {
    document.getElementById('spinner').style.display = 'inline-block';
    this.submit();
    return;
  }

  if (err('id_person_details-name')) {
    return;
  }

  document.querySelector('button').disabled = true;
  document.getElementById('spinner').style.display = 'inline-block';
  stripe.createToken(card, {
    name: document.getElementById('id_personal_details-name').value || ''
  }).then(function(result) {
    if (result.error) {
      document.querySelector('button').disabled = false;
      document.getElementById('spinner').style.display = 'none';
      showError(result.error.message);
    } else {
      var form = document.getElementById('signup_form');
      form.stripeToken.value = result.token.id;
      form.submit();
    }
  });
});

var form = document.getElementById('update_card_form');
form && form.addEventListener('submit', function(e) {
  e.preventDefault();

  if (err('id_personal_details-name')) {
    return;
  }

  document.querySelector('button').disabled = true;
  document.getElementById('spinner').style.display = 'inline-block';
  var request = new XMLHttpRequest();
  request.open("GET", '/account/subscription/update-card');
  request.addEventListener("load", function() {
    var json = JSON.parse(request.responseText);
    var cardholderName = document.getElementById('id_personal_details-name');
    stripe.handleCardSetup(
      json.secret, card, {
      payment_method_data: {
        billing_details: {name: cardholderName.value}
      }
    }).then(function(result) {
      if (result.error) {
        document.querySelector('button').disabled = false;
        document.getElementById('spinner').style.display = 'none';
        showError(result.error.message);
      } else {
        var form = document.getElementById('update_card_form');
        form.payment_method.value = result.setupIntent.payment_method;
        form.submit();
      }
    });
  });
  request.send();
});

})();
