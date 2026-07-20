use strict;
use warnings;
use HTTP::Daemon;
use HTTP::Status;
use File::Spec;

$SIG{CHLD} = 'IGNORE';

my $root = $ARGV[0] or die "usage: static_server.pl <root> <port>\n";
my $port = $ARGV[1] || 5500;

my $d = HTTP::Daemon->new(LocalPort => $port, ReuseAddr => 1) or die "Could not start server: $!";
print "Serving $root at ", $d->url, "\n";
$| = 1;

my %types = (
  html => 'text/html', htm => 'text/html', js => 'application/javascript',
  css => 'text/css', json => 'application/json', png => 'image/png',
  jpg => 'image/jpeg', jpeg => 'image/jpeg', svg => 'image/svg+xml',
  gif => 'image/gif', mp3 => 'audio/mpeg', ogg => 'audio/ogg',
  wav => 'audio/wav', webp => 'image/webp', ico => 'image/x-icon',
);

while (my $c = $d->accept) {
  # Fork per connection so a slow/keep-alive request (e.g. streamed audio)
  # can never block other in-flight requests like JS file loads.
  my $pid = fork();
  if (!defined $pid) {
    $c->close;
    next;
  }
  if ($pid) {
    $c->close; # parent doesn't handle this connection
    next;
  }
  # child
  while (my $r = $c->get_request) {
    if ($r->method eq 'GET') {
      my $path = $r->uri->path;
      $path = '/index.html' if $path eq '/';
      $path =~ s/^\///;
      my $file = File::Spec->catfile($root, split('/', $path));
      if (-f $file) {
        open(my $fh, '<:raw', $file) or do { $c->send_error(500); next; };
        local $/;
        my $data = <$fh>;
        close $fh;
        my ($ext) = $file =~ /\.([^.]+)$/;
        my $ct = $types{lc($ext // '')} || 'application/octet-stream';
        my $resp = HTTP::Response->new(200, 'OK', ['Content-Type' => $ct, 'Connection' => 'close'], $data);
        $c->send_response($resp);
      } else {
        $c->send_error(404);
      }
    } else {
      $c->send_error(RC_FORBIDDEN);
    }
    last; # one request per connection, then close -- avoids keep-alive hangs
  }
  $c->close;
  exit(0);
}
