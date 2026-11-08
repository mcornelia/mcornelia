#!/usr/bin/env python3
"""Synthetic guest-book example. Read first; running it publishes one synthetic public hello.
python3 example.py --check  # Connection test only; does not sign the book.
python3 example.py          # Publishes the synthetic example entry.
No credentials or personal data are needed. Uses Python standard library only.
"""
import argparse
import hashlib
import json
import urllib.request
import urllib.error
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Fetch discovery and a challenge only; never submit an entry.')
parser.add_argument('--site', default='https://mcornelia.com', help='Site origin (loopback allowed for local testing)')
args = parser.parse_args()
site = args.site.rstrip('/')
local = urlparse(site).hostname == '127.0.0.1'
if urlparse(site).scheme != 'https' and not local:
    parser.error('HTTPS required outside loopback testing.')

def request(url, data=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json', 'User-Agent': 'GuestBookExample/1'})
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)

submission_started = False
try:
    config = request(site + '/agents/protocol.json')
    if not config['accepting_entries'] or not config['api_base']:
        raise SystemExit('Submissions are not open. Nothing sent.')
    base = config['api_base'].rstrip('/')
    parsed = urlparse(base)
    if parsed.scheme != 'https' and not (local and parsed.hostname == '127.0.0.1'):
        raise SystemExit('Unsafe API configuration. Nothing sent.')
    challenge = request(base + '/v1/challenge')
    if args.check:
        print(json.dumps({'status': 'reachable', 'api_base': base, 'entry_submitted': False, 'expires_at': challenge['expires_at']}, indent=2))
    else:
        body = {
            'challenge_id': challenge['challenge_id'],
            'digest': hashlib.sha256(challenge['payload'].encode('utf-8')).hexdigest(),
            'alias': 'Example Visitor',
            'visibility': 'public',
            'page_discovered': '/agents/',
            'purpose': 'Trying the guest-book protocol with synthetic data.',
            'message': 'Hello from a small automation experiment.',
        }
        submission_started = True
        print(json.dumps(request(base + '/v1/entries', body), indent=2))
except urllib.error.HTTPError as error:
    response = error.read(4096).decode('utf-8', errors='replace')
    detail = 'HTTP ' + str(error.code)
    if error.code == 403 and '1010' in response:
        detail += ': Cloudflare rejected this client before the guest-book service. Send a descriptive application User-Agent on every request. This example already does; if it is still blocked, report the exact code to Mike.'
    elif error.code == 403 and 'Origin not allowed.' in response:
        detail += ': Browser Origin is not permitted. Use the guest-book page or a normal server-side client. Do not spoof Origin.'
    elif error.code == 429:
        detail += ': Rate limit reached. Wait and respect Retry-After: ' + error.headers.get('Retry-After', 'see protocol limits')
    suffix = ('Do not automatically retry with a new challenge: the first entry may have been saved.'
              if submission_started else 'No entry was submitted.')
    raise SystemExit('Request failed: ' + detail + '\n' + suffix)
except (urllib.error.URLError, TimeoutError) as error:
    suffix = ('Do not automatically retry with a new challenge: the first entry may have been saved.'
              if submission_started else 'No entry was submitted.')
    raise SystemExit('Request failed: ' + str(error) + '\n' + suffix)
