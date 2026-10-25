import unittest
from addon_movie2 import media_from_player, parse_servers, unpack_numeric_packer


class Movie2Tests(unittest.TestCase):
    def test_server_ids(self):
        self.assertEqual(parse_servers('mixdrop=abc123&amp;streamtape=xyz'),
                         {'mixdrop': 'abc123', 'streamtape': 'xyz'})
        self.assertEqual(parse_servers('mixdrop=https://bad.example/video'), {})

    def test_literal_packer_never_executes(self):
        packed = "eval(function(p,a,c,k,e,d){}('0.1=\"//2/3.mp4\"',10,4,'MDCore|wurl|host|movie'.split('|'),0,{}))"
        self.assertEqual(unpack_numeric_packer(packed), 'MDCore.wurl="//host/movie.mp4"')

    def test_media_host_restricted(self):
        template = "<script>eval(function(p,a,c,k,e,d){}('0.1=\"//2/v.mp4\"',10,3,'MDCore|wurl|%s'.split('|'),0,{}))</script>"
        self.assertEqual(media_from_player(template % 'a.mxcontent.net'), 'https://a.mxcontent.net/v.mp4')
        with self.assertRaisesRegex(ValueError, 'unexpected media host'):
            media_from_player(template % 'bad.example')


if __name__ == '__main__':
    unittest.main()
