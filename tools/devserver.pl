#!/usr/bin/perl
# Minimal static file server for local development / browser testing.
#
# Why this exists: Kingdom Marches is a plain static site (index.html plus
# js/, css/, assets/), but it MUST be served over HTTP rather than opened as
# a file:// URL -- the module scripts and asset fetches are subject to
# same-origin rules that file:// fails. This machine has no node or python
# available, so this uses the Perl that ships with Git for Windows, which is
# the one interpreter that's reliably present.
#
# Deliberately single-threaded and connection-close: it serves one asset at a
# time, which is plenty for a local browser check and keeps the whole thing
# short enough to audit at a glance. $SIG{PIPE}='IGNORE' matters -- the
# browser routinely abandons requests for audio it decided not to buffer, and
# an unhandled SIGPIPE would kill the server mid-session.
#
# Usage: perl tools/devserver.pl [port]   (default 8777, serves from cwd)

use strict;
use warnings;
use IO::Socket::INET;
use IO::Select;

$| = 1;
$SIG{PIPE} = 'IGNORE';

# Read timeout for a connected-but-silent socket (a browser preconnect that
# opens a TCP connection without sending a request, or sends one and stalls
# partway through). Without this, a bare blocking <$client> read on such a
# socket wedges the ENTIRE accept loop forever, since this server is
# deliberately single-threaded -- confirmed as a real failure mode in an
# earlier session's throwaway version of this same script (see project
# memory kingdom-marches-local-server). 2 seconds is generous for a same-
# machine request; a genuine client is done sending well before that.
use constant READ_TIMEOUT => 2;

# Reads one line (up to and including "\n") from `$sock`, waiting at most
# READ_TIMEOUT seconds for data to actually arrive each time the buffer runs
# dry. Returns undef on timeout or a closed connection -- both callers below
# already treat undef as "nothing usable came in, move on."
sub read_line_with_timeout {
    my ($sock) = @_;
    my $sel = IO::Select->new($sock);
    my $line = '';
    while (1) {
        return $line if $line =~ /\n\z/;
        return undef unless $sel->can_read(READ_TIMEOUT);
        my $buf;
        my $n = sysread($sock, $buf, 1);
        return undef if !defined($n) || $n == 0;
        $line .= $buf;
    }
}

my $port = shift(@ARGV) || 8777;

my %TYPES = (
    html => 'text/html; charset=utf-8',
    js   => 'application/javascript; charset=utf-8',
    css  => 'text/css; charset=utf-8',
    json => 'application/json; charset=utf-8',
    svg  => 'image/svg+xml',
    png  => 'image/png',
    jpg  => 'image/jpeg',
    jpeg => 'image/jpeg',
    webp => 'image/webp',
    gif  => 'image/gif',
    ico  => 'image/x-icon',
    mp3  => 'audio/mpeg',
    ogg  => 'audio/ogg',
    wav  => 'audio/wav',
    txt  => 'text/plain; charset=utf-8',
);

my $server = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1',
    LocalPort => $port,
    Listen    => 20,
    ReuseAddr => 1,
) or die "Cannot listen on port $port: $!\n";

print "devserver listening on http://127.0.0.1:$port/\n";

while (my $client = $server->accept) {
    my $request = read_line_with_timeout($client);
    unless (defined $request) { close $client; next; }

    # Drain the rest of the request headers so the client doesn't block --
    # timeout-guarded the same way, so a request that stalls mid-headers
    # times out this ONE connection instead of the whole server.
    while (1) {
        my $line = read_line_with_timeout($client);
        last unless defined $line;
        last if $line =~ /^\s*\r?\n\z/;
    }

    my ($path) = $request =~ m{^GET\s+(\S+)};
    unless (defined $path) { close $client; next; }

    $path =~ s/\?.*//;               # strip query string
    $path = '/index.html' if $path eq '/';
    $path =~ s{\.\.}{}g;             # refuse to walk above the served root

    my $file = '.' . $path;
    if (-f $file) {
        my ($ext) = $file =~ /\.([A-Za-z0-9]+)$/;
        my $type = $TYPES{ lc($ext || '') } || 'application/octet-stream';
        open(my $fh, '<', $file) or next;
        binmode $fh;
        local $/;
        my $body = <$fh>;
        close $fh;
        print $client "HTTP/1.1 200 OK\r\n"
            . "Content-Type: $type\r\n"
            . "Content-Length: " . length($body) . "\r\n"
            . "Cache-Control: no-store\r\n"
            . "Connection: close\r\n\r\n";
        print $client $body;
    }
    else {
        print $client "HTTP/1.1 404 Not Found\r\n"
            . "Content-Length: 0\r\n"
            . "Connection: close\r\n\r\n";
    }
    close $client;
}
