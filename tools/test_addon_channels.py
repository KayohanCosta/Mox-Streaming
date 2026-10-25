import unittest
from addon_channels import parse_channels


class ChannelCatalogTests(unittest.TestCase):
    def test_categories_fortaleza_and_quality_variants(self):
        xml = '''<channels><channel_1>
        <item><title>CANAIS ABERTOS</title><link>here</link></item>
        <item><title>RECORD RECIFE HD</title><link>chresolver1=1#1</link></item>
        <item><title>RECORD FORTALEZA SD</title><link>chresolver1=2#1</link></item>
        <item><title>RECORD FORTALEZA HD</title><link>chresolver1=3#1</link></item>
        <item><title>RECORD FORTALEZA FHD</title><link>chresolver1=4#1</link></item>
        <item><title>TV BRASIL HD</title><link>chresolver1=5#1</link></item>
        <item><title>TV BRASIL H265 HD</title><link>chresolver1=6#1</link></item>
        </channel_1></channels>'''
        result = parse_channels(xml)
        self.assertEqual([item['title'] for item in result], ['Record Fortaleza', 'Tv Brasil'])
        self.assertEqual(set(result[0]['qualities']), {'low', '720', '1080'})
        self.assertEqual(result[1]['qualities']['720']['reference'], 'chresolver1=5#1')
        self.assertFalse(result[0]['playback_validated'])


if __name__ == '__main__':
    unittest.main()
