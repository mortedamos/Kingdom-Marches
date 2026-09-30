#!/usr/bin/perl
# Trailer capture server.
#
# Serves the repo as static files (like tools/devserver.pl) AND accepts the
# rendered trailer frame by frame, piping each JPEG straight into ffmpeg, so a
# 60 s trailer never has to sit on disk as 1800 loose images. Frames are
# rendered deterministically by trailer.js, so the video is perfectly smooth
# no matter how slow the browser is.
#
# Runs on its own port (8778 by default) so the game's service worker, which
# is scoped to the devserver's origin, never intercepts anything here.
#
# Usage (from the repo root):
#   perl trailer/capture-server.pl [port]
#   then open http://127.0.0.1:8778/trailer/  and press "Render MP4".
#
# Endpoints:
#   POST /capture/start        body: "fps"        -> spawns ffmpeg video encoder
#   POST /capture/frame?i=N    body: JPEG bytes   -> frame N
#   POST /capture/finish       body: ffmpeg args, one per line (the audio mix,
#                              built by trailer.js from its own cue list)
#   POST /capture/still/NAME   body: image        -> trailer/out/stills/NAME
#   GET  /capture/ping                            -> "ok"
#   GET  /capture/status                          -> frames so far, -1 if idle

use strict;
use warnings;
use IO::Socket::INET;
use IO::Select;

$| = 1;
$SIG{PIPE} = 'IGNORE';
# Hand arguments to the native ffmpeg.exe untouched -- MSYS would otherwise
# rewrite anything that looks like a POSIX path inside filter strings.
$ENV{MSYS_NO_PATHCONV} = 1;
$ENV{MSYS2_ARG_CONV_EXCL} = '*';

use constant READ_TIMEOUT => 5;    # once a request has started arriving
use constant IDLE_TIMEOUT => 30;   # a connection that never sends anything

my $FFMPEG = $ENV{FFMPEG} || 'C:/Program Files (x86)/ffmpeg/bin/ffmpeg.exe';
my $OUT    = 'trailer/out';
my $port   = $ENV{PORT} || shift(@ARGV) || 8778;

mkdir $OUT unless -d $OUT;

my %TYPES = (
    html => 'text/html; charset=utf-8',
    js   => 'application/javascript; charset=utf-8',
    css  => 'text/css; charset=utf-8',
    json => 'application/json; charset=utf-8',
    svg  => 'image/svg+xml',
    png  => 'image/png',
    jpg  => 'image/jpeg',
    mp3  => 'audio/mpeg',
    mp4  => 'video/mp4',
    woff2 => 'font/woff2',
    txt  => 'text/plain; charset=utf-8',
);

sub read_line {
    my ($sock) = @_;
    my $sel = IO::Select->new($sock);
    my $line = '';
    while (1) {
        return $line if $line =~ /\n\z/;
        return undef unless $sel->can_read(READ_TIMEOUT);
        my $n = sysread($sock, my $buf, 1);
        return undef if !defined($n) || $n == 0;
        $line .= $buf;
    }
}

sub read_body {
    my ($sock, $len) = @_;
    my $sel = IO::Select->new($sock);
    my $body = '';
    while (length($body) < $len) {
        return undef unless $sel->can_read(READ_TIMEOUT);
        my $n = sysread($sock, my $buf, $len - length($body));
        return undef if !defined($n) || $n == 0;
        $body .= $buf;
    }
    return $body;
}

sub respond {
    my ($sock, $status, $type, $body, $extra) = @_;
    print $sock "HTTP/1.1 $status\r\n"
        . "Content-Type: $type\r\n"
        . "Content-Length: " . length($body) . "\r\n"
        . "Cache-Control: no-store\r\n"
        . ($extra || '')
        . "Connection: close\r\n\r\n";
    print $sock $body;
}

my $ff;          # pipe into the video encoder while a capture is running
my $frames = 0;

# One complete request on a socket that already has data waiting.
sub handle {
    my ($client) = @_;
    my $request = read_line($client);
    return unless defined $request;

    my $len = 0;
    while (1) {
        my $line = read_line($client);
        last unless defined $line;
        last if $line =~ /^\s*\r?\n\z/;
        $len = $1 if $line =~ /^Content-Length:\s*(\d+)/i;
    }

    my ($method, $path) = $request =~ m{^(GET|POST)\s+(\S+)};
    return unless defined $path;
    my ($index) = $path =~ /[?&]i=(\d+)/;
    $path =~ s/\?.*//;

    if ($method eq 'POST') {
        my $body = read_body($client, $len);
        return unless defined $body;

        if ($path eq '/capture/start') {
            close $ff if $ff;
            my ($fps) = $body =~ /(\d+)/;
            $fps ||= 30;
            $frames = 0;
            unless (open($ff, '|-', $FFMPEG, qw(-y -loglevel error -f image2pipe -framerate), $fps,
                    qw(-c:v mjpeg -i - -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p),
                    "$OUT/video.mp4")) {
                undef $ff;
                return respond($client, '500 Error', 'text/plain', "ffmpeg: $!");
            }
            binmode $ff;
            print "capture started at $fps fps\n";
            respond($client, '200 OK', 'text/plain', 'ok');
        }
        elsif ($path eq '/capture/frame') {
            # ?i=N is the frame index: a retried frame we already have is
            # acknowledged without writing it twice, so timing never drifts.
            my $status = '200 OK';
            if (!$ff || (defined $index && $index > $frames)) { $status = '409 Conflict'; }
            elsif (!defined $index || $index == $frames) {
                print $ff $body; $frames++;
                print "  $frames frames\n" if $frames % 150 == 0;
            }
            respond($client, $status, 'text/plain', $frames);
        }
        elsif ($path eq '/capture/finish') {
            close $ff if $ff;   # waits for the encoder to flush
            undef $ff;
            print "video done ($frames frames), mixing audio...\n";
            my @args = grep { length } split /\r?\n/, $body;
            my $rc = system($FFMPEG, @args);
            my $msg = $rc == 0 ? "ok $OUT/kingdom-marches-trailer.mp4" : "audio mix failed ($rc)";
            print "$msg\n";
            respond($client, $rc == 0 ? '200 OK' : '500 Error', 'text/plain', $msg);
        }
        elsif ($path =~ m{^/capture/still/([\w.-]+\.(?:png|jpg))$}) {
            mkdir "$OUT/stills" unless -d "$OUT/stills";
            open(my $fh, '>', "$OUT/stills/$1") or return respond($client, '500 Error', 'text/plain', "$!");
            binmode $fh; print $fh $body; close $fh;
            respond($client, '200 OK', 'text/plain', 'ok');
        }
        else {
            respond($client, '404 Not Found', 'text/plain', '');
        }
        return;
    }

    return respond($client, '200 OK', 'text/plain', 'ok') if $path eq '/capture/ping';
    # Frames received so far, or -1 when no capture is open (lets a
    # reloaded page resume a render instead of starting over).
    return respond($client, '200 OK', 'text/plain', $ff ? $frames : -1) if $path eq '/capture/status';

    if ($path eq '/' || $path eq '/trailer') {
        # The page uses relative paths, so it must live under /trailer/.
        return respond($client, '302 Found', 'text/plain', '', "Location: /trailer/\r\n");
    }
    $path = '/trailer/index.html' if $path eq '/trailer/';
    $path =~ s{\.\.}{}g;
    my $file = '.' . $path;
    if (-f $file) {
        my ($ext) = $file =~ /\.([A-Za-z0-9]+)$/;
        open(my $fh, '<', $file) or return;
        binmode $fh;
        local $/;
        my $body = <$fh>;
        close $fh;
        respond($client, '200 OK', $TYPES{ lc($ext || '') } || 'application/octet-stream', $body);
    }
    else {
        respond($client, '404 Not Found', 'text/plain', '');
    }
}

my $server = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1', LocalPort => $port, Listen => 64, ReuseAddr => 1,
) or die "Cannot listen on port $port: $!\n";

print "trailer capture server on http://127.0.0.1:$port/trailer/\n";

# Browsers pre-open spare connections and may not send on them for a while.
# Blocking on one of those would stall every other request (and drop frames),
# so accepted sockets wait in a select set and are only handled once they
# actually have data.
my $sel = IO::Select->new($server);
my %opened;
while (1) {
    for my $s ($sel->can_read(1)) {
        if ($s == $server) {
            my $c = $server->accept or next;
            binmode $c;
            $sel->add($c);
            $opened{fileno $c} = time;
            next;
        }
        $sel->remove($s);
        delete $opened{fileno $s};
        handle($s);
        close $s;
    }
    for my $c ($sel->handles) {
        next if $c == $server;
        next if time - ($opened{fileno $c} || 0) < IDLE_TIMEOUT;
        $sel->remove($c);
        delete $opened{fileno $c};
        close $c;
    }
}
