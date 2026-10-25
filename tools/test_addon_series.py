import unittest
from addon_series import parse_search_results


class SeriesSearchTests(unittest.TestCase):
    def test_exact_title_and_year(self):
        page = '''<a href="https://www.overflix.press/series/online/cyberpunk-mercenarios-dublado-14562/">
          <div class="info"><h3>Cyberpunk: Mercenários</h3><p>2022</p></div></a>
          <a href="https://www.overflix.press/series/online/cyberpunk-outro-99999/">
          <div class="info"><h3>Cyberpunk: Outra História</h3><p>2022</p></div></a>'''
        self.assertEqual(parse_search_results(page, 'www.overflix.press', 'Cyberpunk: Mercenários', '2022'),
                         ['serie3=cyberpunk-mercenarios-dublado-14562'])
        self.assertEqual(parse_search_results(page, 'www.overflix.press', 'Cyberpunk: Mercenários', '2023'), [])

    def test_rejects_external_and_similar_titles(self):
        page = '''<a href="https://other.example/series/online/cyberpunk-mercenarios-dublado-14562/">
          <h3>Cyberpunk: Mercenários</h3><p>2022</p></a>
          <a href="https://www.overflix.press/series/online/cyberpunk-mercenarios-2-14562/">
          <h3>Cyberpunk: Mercenários 2</h3><p>2022</p></a>'''
        self.assertEqual(parse_search_results(page, 'www.overflix.press', 'Cyberpunk: Mercenários', '2022'), [])


if __name__ == '__main__':
    unittest.main()
